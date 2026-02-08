# Cost-Management Skills

Consolidated skill reference for Cost-Management operations.

---

# BIM Cost Estimation with Jens CWICR

Generate accurate cost estimates from BIM models using AI classification and the Jens CWICR construction cost database.

## Business Case

**Problem**: Traditional cost estimation:
- Manual and time-consuming (weeks for detailed estimate)
- Subjective and inconsistent between estimators
- Requires specialized knowledge
- Difficult to update with design changes

**Solution**: Automated BIM-to-cost pipeline:
- Extract quantities directly from model
- AI classifies elements to work items
- Vector search finds matching prices in CWICR
- Complete estimate in hours, not weeks

**ROI**: 80% reduction in estimation time, consistent methodology

## System Architecture

```
┌──────────────────────────────────────────────────────────────────────────┐
│                  BIM TO COST ESTIMATION PIPELINE                          │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│   ┌─────────┐     ┌─────────┐     ┌─────────┐     ┌─────────────────┐   │
│   │ BIM     │     │ Jens     │     │ AI      │     │ Jens CWICR       │   │
│   │ Model   │────►│Converter│────►│ LLM     │────►│ Vector Search   │   │
│   │.rvt/.ifc│     │         │     │         │     │ (Qdrant)        │   │
│   └─────────┘     └─────────┘     └─────────┘     └─────────────────┘   │
│                        │              │                    │             │
│                        ▼              ▼                    ▼             │
│                   ┌─────────┐    ┌─────────┐         ┌──────────┐       │
│                   │ .xlsx   │    │ Work    │         │ Matched  │       │
│                   │ QTO     │    │ Items   │         │ Rates    │       │
│                   └─────────┘    └─────────┘         └──────────┘       │
│                        │              │                    │             │
│                        └──────────────┼────────────────────┘             │
│                                       ▼                                  │
│                              ┌─────────────────┐                        │
│                              │ COST ESTIMATE   │                        │
│                              │                 │                        │
│                              │ • By element    │                        │
│                              │ • By trade      │                        │
│                              │ • By phase      │                        │
│                              │ • Resources     │                        │
│                              └─────────────────┘                        │
│                                                                           │
└──────────────────────────────────────────────────────────────────────────┘
```

## Jens CWICR Database

```yaml
Database Overview:
  work_items: 55,719
  resources: 27,672
  languages: 9 (AR, DE, EN, ES, FR, HI, PT, RU, ZH)
  fields_per_item: 85
  embedding_model: text-embedding-004 (3072d)
  vector_db: Qdrant

Collections:
  - ddc_cwicr_ar  # Arabic (Dubai prices)
  - ddc_cwicr_de  # German (Berlin prices)
  - ddc_cwicr_en  # English (Toronto prices)
  - ddc_cwicr_es  # Spanish (Barcelona prices)
  - ddc_cwicr_fr  # French (Paris prices)
  - ddc_cwicr_hi  # Hindi (Mumbai prices)
  - ddc_cwicr_pt  # Portuguese (São Paulo prices)
  - ddc_cwicr_ru  # Russian (St. Petersburg prices)
  - ddc_cwicr_zh  # Chinese (Shanghai prices)
```

## Pipeline Stages

| Stage | Name | Description |
|-------|------|-------------|
| 0 | Collect BIM Data | Extract elements from Revit/IFC |
| 1 | Project Detection | AI identifies project type |
| 2 | Phase Generation | AI creates construction phases |
| 3 | Element Assignment | AI maps types to phases |
| 4 | Work Decomposition | AI breaks types into work items |
| 5 | Vector Search | Find matching rates in CWICR |
| 6 | Unit Mapping | Convert BIM units to rate units |
| 7 | Cost Calculation | Qty × Unit Price |
| 7.5 | Validation | CTO review for completeness |
| 8 | Aggregation | Sum by phases and categories |
| 9 | Report Generation | HTML and Excel outputs |

## Python Implementation

```python
import pandas as pd
import numpy as np
from qdrant_client import QdrantClient
from qdrant_client.models import Filter, FieldCondition, MatchValue
from google_gemini import Google Gemini
from typing import List, Dict, Optional
from dataclasses import dataclass
import json

@dataclass
class WorkItem:
    """Matched work item from CWICR"""
    cwicr_code: str
    description: str
    unit: str
    unit_price: float
    labor_cost: float
    material_cost: float
    equipment_cost: float
    productivity: float  # units per hour
    currency: str
    confidence: float

@dataclass
class CostLineItem:
    """Single line item in estimate"""
    bim_type: str
    work_item: WorkItem
    quantity: float
    quantity_unit: str
    total_cost: float
    labor_cost: float
    material_cost: float
    equipment_cost: float
    phase: str
    trade: str


class BIMCostEstimator:
    """BIM to cost estimation using Jens CWICR"""

    def __init__(
        self,
        qdrant_url: str,
        qdrant_api_key: str = None,
        google_gemini_api_key: str = None,
        language: str = "EN"
    ):
        self.qdrant = QdrantClient(url=qdrant_url, api_key=qdrant_api_key)
        self.google_gemini = Google Gemini(api_key=google_gemini_api_key)
        self.language = language
        self.collection = f"ddc_cwicr_{language.lower()}"

    def get_embedding(self, text: str) -> List[float]:
        """Generate embedding for text"""
        response = self.google_gemini.embeddings.create(
            model="text-embedding-004",
            input=text,
            dimensions=3072
        )
        return response.data[0].embedding

    def search_cwicr(
        self,
        query: str,
        limit: int = 5,
        category_filter: str = None
    ) -> List[WorkItem]:
        """Search CWICR database for matching work items"""

        # Get embedding
        query_vector = self.get_embedding(query)

        # Build filter if category specified
        query_filter = None
        if category_filter:
            query_filter = Filter(
                must=[
                    FieldCondition(
                        key="category",
                        match=MatchValue(value=category_filter)
                    )
                ]
            )

        # Search
        results = self.qdrant.search(
            collection_name=self.collection,
            query_vector=query_vector,
            query_filter=query_filter,
            limit=limit
        )

        # Parse results
        work_items = []
        for r in results:
            payload = r.payload
            work_items.append(WorkItem(
                cwicr_code=payload.get('code', ''),
                description=payload.get('description', ''),
                unit=payload.get('unit', ''),
                unit_price=float(payload.get('unit_price', 0)),
                labor_cost=float(payload.get('labor_cost', 0)),
                material_cost=float(payload.get('material_cost', 0)),
                equipment_cost=float(payload.get('equipment_cost', 0)),
                productivity=float(payload.get('productivity', 1)),
                currency=payload.get('currency', 'USD'),
                confidence=r.score
            ))

        return work_items

    def decompose_bim_type(
        self,
        bim_type: str,
        category: str
    ) -> List[str]:
        """Use LLM to decompose BIM type into work items"""

        prompt = f"""
Decompose this BIM element type into construction work items:

BIM Type: {bim_type}
Category: {category}

List the individual work activities needed to construct this element.
For example, "Brick Wall 240mm" decomposes into:
- Masonry: Brick laying
- Mortar: Cement mortar for joints
- Plaster: Internal plaster finish
- Paint: Wall painting

Return a JSON array of work item descriptions.
Example: ["Brick masonry laying", "Cement mortar for brick joints", "Internal cement plaster 15mm"]
"""

        response = self.google_gemini.chat.completions.create(
            model="gemini-2.0-flash",
            messages=[{"role": "user", "content": prompt}],
            response_format={"type": "json_object"}
        )

        try:
            result = json.loads(response.choices[0].message.content)
            return result.get('work_items', [bim_type])
        except:
            return [bim_type]

    def estimate_element(
        self,
        bim_type: str,
        category: str,
        quantity: float,
        quantity_unit: str,
        phase: str = "Construction"
    ) -> List[CostLineItem]:
        """Estimate cost for single BIM element type"""

        # Decompose into work items
        work_descriptions = self.decompose_bim_type(bim_type, category)

        line_items = []

        for work_desc in work_descriptions:
            # Search CWICR for matching rate
            matches = self.search_cwicr(work_desc, limit=1)

            if not matches:
                continue

            best_match = matches[0]

            # Convert quantity if units don't match
            adjusted_qty = self._convert_units(
                quantity, quantity_unit, best_match.unit
            )

            # Calculate costs
            total = adjusted_qty * best_match.unit_price
            labor = adjusted_qty * best_match.labor_cost
            material = adjusted_qty * best_match.material_cost
            equipment = adjusted_qty * best_match.equipment_cost

            line_items.append(CostLineItem(
                bim_type=bim_type,
                work_item=best_match,
                quantity=adjusted_qty,
                quantity_unit=best_match.unit,
                total_cost=total,
                labor_cost=labor,
                material_cost=material,
                equipment_cost=equipment,
                phase=phase,
                trade=self._get_trade(category)
            ))

        return line_items

    def estimate_from_qto(
        self,
        qto_data: pd.DataFrame,
        type_column: str = "Type Name",
        category_column: str = "Category",
        quantity_column: str = "Volume"
    ) -> List[CostLineItem]:
        """Generate estimate from QTO DataFrame"""

        all_line_items = []

        # Group by type
        grouped = qto_data.groupby([category_column, type_column]).agg({
            quantity_column: 'sum'
        }).reset_index()

        for _, row in grouped.iterrows():
            items = self.estimate_element(
                bim_type=row[type_column],
                category=row[category_column],
                quantity=row[quantity_column],
                quantity_unit="m³"  # Assume volume, adjust based on category
            )
            all_line_items.extend(items)

        return all_line_items

    def _convert_units(
        self,
        value: float,
        from_unit: str,
        to_unit: str
    ) -> float:
        """Convert between units"""

        # Simplified conversion - expand as needed
        conversions = {
            ('m³', 'm³'): 1.0,
            ('m²', 'm²'): 1.0,
            ('m', 'm'): 1.0,
            ('ft³', 'm³'): 0.0283168,
            ('ft²', 'm²'): 0.092903,
            ('ft', 'm'): 0.3048,
        }

        key = (from_unit.lower(), to_unit.lower())
        factor = conversions.get(key, 1.0)

        return value * factor

    def _get_trade(self, category: str) -> str:
        """Map BIM category to trade"""
        trade_map = {
            'Walls': 'Masonry',
            'Floors': 'Concrete',
            'Structural Columns': 'Concrete',
            'Structural Framing': 'Steel',
            'Doors': 'Carpentry',
            'Windows': 'Glazing',
            'Plumbing Fixtures': 'Plumbing',
            'Electrical Equipment': 'Electrical',
            'Mechanical Equipment': 'HVAC'
        }
        return trade_map.get(category, 'General')

    def generate_estimate_report(
        self,
        line_items: List[CostLineItem],
        project_name: str,
        output_path: str
    ) -> dict:
        """Generate comprehensive estimate report"""

        # Convert to DataFrame
        records = []
        for item in line_items:
            records.append({
                'BIM Type': item.bim_type,
                'Work Item': item.work_item.description,
                'CWICR Code': item.work_item.cwicr_code,
                'Quantity': round(item.quantity, 2),
                'Unit': item.quantity_unit,
                'Unit Price': round(item.work_item.unit_price, 2),
                'Labor': round(item.labor_cost, 2),
                'Material': round(item.material_cost, 2),
                'Equipment': round(item.equipment_cost, 2),
                'Total': round(item.total_cost, 2),
                'Phase': item.phase,
                'Trade': item.trade,
                'Currency': item.work_item.currency,
                'Confidence': round(item.work_item.confidence, 2)
            })

        df = pd.DataFrame(records)

        # Calculate totals
        total_cost = df['Total'].sum()
        total_labor = df['Labor'].sum()
        total_material = df['Material'].sum()
        total_equipment = df['Equipment'].sum()

        # Summary by trade
        by_trade = df.groupby('Trade')['Total'].sum().sort_values(ascending=False)

        # Write Excel
        excel_path = f"{output_path}/{project_name}_Estimate.xlsx"
        with pd.ExcelWriter(excel_path, engine='openpyxl') as writer:
            # Summary sheet
            summary_data = {
                'Metric': ['Total Cost', 'Labor Cost', 'Material Cost', 'Equipment Cost'],
                'Value': [total_cost, total_labor, total_material, total_equipment]
            }
            pd.DataFrame(summary_data).to_excel(writer, sheet_name='Summary', index=False)

            # By Trade
            by_trade.to_frame().to_excel(writer, sheet_name='By Trade')

            # Detail
            df.to_excel(writer, sheet_name='Detail', index=False)

        return {
            'excel_path': excel_path,
            'total_cost': total_cost,
            'total_labor': total_labor,
            'total_material': total_material,
            'total_equipment': total_equipment,
            'by_trade': by_trade.to_dict(),
            'line_items': len(df),
            'currency': line_items[0].work_item.currency if line_items else 'USD'
        }


# Usage Example
def estimate_from_bim_model(
    model_path: str,
    qdrant_url: str,
    language: str = "EN",
    output_dir: str = "."
) -> dict:
    """Complete BIM to cost estimation workflow"""

    import subprocess
    from pathlib import Path

    # Step 1: Convert BIM to Excel
    print("Converting BIM model...")
    subprocess.run([
        r"C:\Jens\RvtExporter.exe",
        model_path,
        "complete", "bbox"
    ])

    xlsx_path = Path(model_path).with_suffix('.xlsx')

    # Step 2: Load QTO data
    print("Loading quantity data...")
    df = pd.read_excel(xlsx_path)

    # Step 3: Initialize estimator
    estimator = BIMCostEstimator(
        qdrant_url=qdrant_url,
        language=language
    )

    # Step 4: Generate estimate
    print("Generating cost estimate...")
    line_items = estimator.estimate_from_qto(df)

    # Step 5: Generate report
    project_name = Path(model_path).stem
    result = estimator.generate_estimate_report(
        line_items=line_items,
        project_name=project_name,
        output_path=output_dir
    )

    print(f"\nEstimate Complete!")
    print(f"Total Cost: {result['currency']} {result['total_cost']:,.2f}")
    print(f"Excel Report: {result['excel_path']}")

    return result


if __name__ == "__main__":
    result = estimate_from_bim_model(
        model_path=r"C:\Projects\Building.rvt",
        qdrant_url="https://your-qdrant-instance.io",
        language="DE",
        output_dir=r"C:\Projects\Estimates"
    )
```

## n8n Workflow

See: `n8n_4_CAD_(BIM)_Cost_Estimation_Pipeline_4D_5D_with_DDC_CWICR.json`

```yaml
stages:
  - convert: RvtExporter → XLSX
  - detect_project: LLM identifies project type
  - generate_phases: LLM creates construction phases
  - decompose: LLM breaks types into work items
  - vector_search: Qdrant finds CWICR matches
  - calculate: Qty × Unit Price
  - validate: CTO review
  - report: HTML + Excel output
```

## Output Example

```
╔══════════════════════════════════════════════════════════════╗
║                    COST ESTIMATE SUMMARY                      ║
║   Project: Office Building Berlin                             ║
║   Date: 2026-01-24                                           ║
╠══════════════════════════════════════════════════════════════╣

TOTAL PROJECT COST:                    EUR 4,523,678.00
───────────────────────────────────────────────────────────────
  Labor:                               EUR 1,847,234.00 (41%)
  Materials:                           EUR 2,312,456.00 (51%)
  Equipment:                           EUR   363,988.00 ( 8%)

BY TRADE
───────────────────────────────────────────────────────────────
  Concrete:                            EUR 1,234,567.00 (27%)
  Masonry:                             EUR   876,543.00 (19%)
  Steel Structure:                     EUR   654,321.00 (14%)
  MEP:                                 EUR   543,210.00 (12%)
  Finishes:                            EUR   432,109.00 (10%)
  Other:                               EUR   782,928.00 (18%)

CONFIDENCE ANALYSIS
───────────────────────────────────────────────────────────────
  High (>0.85):                        78%
  Medium (0.70-0.85):                  18%
  Low (<0.70):                          4%

╚══════════════════════════════════════════════════════════════╝
```

## Resources

- **CWICR Repository**: https://github.com/jens-construction/OpenConstructionEstimate-Jens-CWICR
- **Live Demo**: https://openconstructionestimate.com
- **Qdrant**: https://qdrant.tech

---

*"Resource-based costing separates physical quantities from volatile prices, enabling transparent and auditable estimates."*


---


# Budget Variance Analyzer

## Business Case

### Problem Statement
Cost overruns surprise project teams:
- Late detection of budget issues
- No systematic variance analysis
- Difficult to forecast final costs
- Unclear root causes

### Solution
Systematic budget variance analysis that tracks costs against budget, identifies trends, and forecasts final project costs.

### Business Value
- **Early warning** - Detect overruns early
- **Forecasting** - Predict final costs
- **Accountability** - Track variance causes
- **Decision support** - Informed cost decisions

## Technical Implementation

```python
import pandas as pd
from datetime import datetime, date
from typing import Dict, Any, List, Optional, Tuple
from dataclasses import dataclass, field
from enum import Enum


class VarianceStatus(Enum):
    """Variance status."""
    UNDER_BUDGET = "under_budget"
    ON_BUDGET = "on_budget"
    OVER_BUDGET = "over_budget"
    CRITICAL = "critical"


class CostCategory(Enum):
    """Cost categories."""
    LABOR = "labor"
    MATERIAL = "material"
    EQUIPMENT = "equipment"
    SUBCONTRACTOR = "subcontractor"
    OVERHEAD = "overhead"
    CONTINGENCY = "contingency"
    OTHER = "other"


class VarianceCause(Enum):
    """Common variance causes."""
    SCOPE_CHANGE = "scope_change"
    QUANTITY_CHANGE = "quantity_change"
    PRICE_ESCALATION = "price_escalation"
    PRODUCTIVITY = "productivity"
    REWORK = "rework"
    DELAY = "delay"
    UNFORESEEN = "unforeseen"
    ESTIMATE_ERROR = "estimate_error"
    OTHER = "other"


@dataclass
class BudgetItem:
    """Single budget line item."""
    item_code: str
    description: str
    category: CostCategory
    original_budget: float
    current_budget: float  # After approved changes
    committed_cost: float  # Contracts, POs
    actual_cost: float     # Paid/invoiced
    forecast_cost: float   # Estimate at completion
    percent_complete: float
    notes: str = ""

    @property
    def variance_amount(self) -> float:
        """Budget variance (negative = over budget)."""
        return self.current_budget - self.forecast_cost

    @property
    def variance_percent(self) -> float:
        """Variance as percentage."""
        if self.current_budget == 0:
            return 0
        return (self.variance_amount / self.current_budget) * 100

    @property
    def status(self) -> VarianceStatus:
        """Determine variance status."""
        pct = self.variance_percent
        if pct > 5:
            return VarianceStatus.UNDER_BUDGET
        elif pct >= -5:
            return VarianceStatus.ON_BUDGET
        elif pct >= -15:
            return VarianceStatus.OVER_BUDGET
        else:
            return VarianceStatus.CRITICAL


@dataclass
class VarianceRecord:
    """Record of budget variance."""
    record_id: str
    item_code: str
    variance_amount: float
    cause: VarianceCause
    explanation: str
    recorded_date: date
    recorded_by: str
    approved: bool = False
    approval_date: Optional[date] = None


@dataclass
class ForecastScenario:
    """Cost forecast scenario."""
    name: str
    description: str
    adjustments: Dict[str, float]  # item_code: adjustment amount
    total_forecast: float
    variance_from_budget: float


class BudgetVarianceAnalyzer:
    """Analyze budget vs actual cost variances."""

    VARIANCE_THRESHOLD_WARNING = -0.05  # -5%
    VARIANCE_THRESHOLD_CRITICAL = -0.15  # -15%

    def __init__(self, project_name: str, original_budget: float, currency: str = "USD"):
        self.project_name = project_name
        self.original_budget = original_budget
        self.currency = currency
        self.items: Dict[str, BudgetItem] = {}
        self.variance_records: List[VarianceRecord] = []
        self.history: List[Dict[str, Any]] = []

    def add_budget_item(self,
                       item_code: str,
                       description: str,
                       category: CostCategory,
                       budget: float,
                       committed: float = 0,
                       actual: float = 0,
                       percent_complete: float = 0) -> BudgetItem:
        """Add budget line item."""
        forecast = max(committed, actual / percent_complete * 100) if percent_complete > 0 else budget

        item = BudgetItem(
            item_code=item_code,
            description=description,
            category=category,
            original_budget=budget,
            current_budget=budget,
            committed_cost=committed,
            actual_cost=actual,
            forecast_cost=forecast,
            percent_complete=percent_complete
        )

        self.items[item_code] = item
        return item

    def update_costs(self, item_code: str,
                    committed: float = None,
                    actual: float = None,
                    percent_complete: float = None,
                    forecast: float = None):
        """Update item costs."""
        if item_code not in self.items:
            raise ValueError(f"Item {item_code} not found")

        item = self.items[item_code]

        if committed is not None:
            item.committed_cost = committed
        if actual is not None:
            item.actual_cost = actual
        if percent_complete is not None:
            item.percent_complete = percent_complete
        if forecast is not None:
            item.forecast_cost = forecast
        else:
            # Auto-calculate forecast
            if item.percent_complete > 0:
                item.forecast_cost = item.actual_cost / item.percent_complete * 100
            else:
                item.forecast_cost = max(item.committed_cost, item.current_budget)

        self._record_history()

    def adjust_budget(self, item_code: str, amount: float, reason: str):
        """Adjust current budget (approved change)."""
        if item_code not in self.items:
            raise ValueError(f"Item {item_code} not found")

        self.items[item_code].current_budget += amount
        self.items[item_code].notes += f"\nBudget adjusted by {amount}: {reason}"

    def record_variance(self,
                       item_code: str,
                       cause: VarianceCause,
                       explanation: str,
                       recorded_by: str) -> VarianceRecord:
        """Record variance explanation."""
        item = self.items.get(item_code)
        if not item:
            raise ValueError(f"Item {item_code} not found")

        record_id = f"VAR-{len(self.variance_records) + 1:04d}"

        record = VarianceRecord(
            record_id=record_id,
            item_code=item_code,
            variance_amount=item.variance_amount,
            cause=cause,
            explanation=explanation,
            recorded_date=date.today(),
            recorded_by=recorded_by
        )

        self.variance_records.append(record)
        return record

    def _record_history(self):
        """Record current state to history."""
        snapshot = {
            'date': date.today().isoformat(),
            'total_budget': sum(i.current_budget for i in self.items.values()),
            'total_committed': sum(i.committed_cost for i in self.items.values()),
            'total_actual': sum(i.actual_cost for i in self.items.values()),
            'total_forecast': sum(i.forecast_cost for i in self.items.values())
        }
        self.history.append(snapshot)

    def calculate_summary(self) -> Dict[str, Any]:
        """Calculate overall budget summary."""
        total_budget = sum(i.current_budget for i in self.items.values())
        total_committed = sum(i.committed_cost for i in self.items.values())
        total_actual = sum(i.actual_cost for i in self.items.values())
        total_forecast = sum(i.forecast_cost for i in self.items.values())

        variance = total_budget - total_forecast
        variance_pct = (variance / total_budget * 100) if total_budget > 0 else 0

        # By category
        by_category = {}
        for item in self.items.values():
            cat = item.category.value
            if cat not in by_category:
                by_category[cat] = {
                    'budget': 0, 'actual': 0, 'forecast': 0, 'variance': 0
                }
            by_category[cat]['budget'] += item.current_budget
            by_category[cat]['actual'] += item.actual_cost
            by_category[cat]['forecast'] += item.forecast_cost
            by_category[cat]['variance'] += item.variance_amount

        # Items needing attention
        critical = [i for i in self.items.values() if i.status == VarianceStatus.CRITICAL]
        over_budget = [i for i in self.items.values() if i.status == VarianceStatus.OVER_BUDGET]

        return {
            'project': self.project_name,
            'currency': self.currency,
            'original_budget': self.original_budget,
            'current_budget': total_budget,
            'committed': total_committed,
            'actual': total_actual,
            'forecast': total_forecast,
            'variance': variance,
            'variance_percent': round(variance_pct, 1),
            'status': 'ON_TRACK' if variance >= 0 else 'OVER_BUDGET',
            'by_category': by_category,
            'critical_items': len(critical),
            'over_budget_items': len(over_budget),
            'contingency_used': total_budget - self.original_budget
        }

    def get_critical_items(self) -> List[BudgetItem]:
        """Get items with critical variances."""
        return [i for i in self.items.values()
                if i.status in [VarianceStatus.CRITICAL, VarianceStatus.OVER_BUDGET]]

    def forecast_completion(self,
                           optimistic_factor: float = 0.95,
                           pessimistic_factor: float = 1.15) -> Dict[str, ForecastScenario]:
        """Generate forecast scenarios."""
        current_forecast = sum(i.forecast_cost for i in self.items.values())
        current_budget = sum(i.current_budget for i in self.items.values())

        scenarios = {
            'optimistic': ForecastScenario(
                name="Optimistic",
                description="Best case with no further overruns",
                adjustments={},
                total_forecast=current_forecast * optimistic_factor,
                variance_from_budget=current_budget - (current_forecast * optimistic_factor)
            ),
            'most_likely': ForecastScenario(
                name="Most Likely",
                description="Current trend continues",
                adjustments={},
                total_forecast=current_forecast,
                variance_from_budget=current_budget - current_forecast
            ),
            'pessimistic': ForecastScenario(
                name="Pessimistic",
                description="Additional overruns expected",
                adjustments={},
                total_forecast=current_forecast * pessimistic_factor,
                variance_from_budget=current_budget - (current_forecast * pessimistic_factor)
            )
        }

        return scenarios

    def analyze_trends(self) -> Dict[str, Any]:
        """Analyze cost trends from history."""
        if len(self.history) < 2:
            return {'trend': 'insufficient_data'}

        forecasts = [h['total_forecast'] for h in self.history]
        actuals = [h['total_actual'] for h in self.history]

        # Calculate trend direction
        forecast_trend = forecasts[-1] - forecasts[0]
        actual_trend = actuals[-1] - actuals[0]

        return {
            'forecast_trend': 'increasing' if forecast_trend > 0 else 'decreasing',
            'forecast_change': forecast_trend,
            'actual_trend': 'increasing' if actual_trend > 0 else 'stable',
            'actual_change': actual_trend,
            'data_points': len(self.history)
        }

    def export_variance_report(self, output_path: str):
        """Export detailed variance report to Excel."""
        with pd.ExcelWriter(output_path, engine='openpyxl') as writer:
            # Summary
            summary = self.calculate_summary()
            summary_df = pd.DataFrame([
                {'Metric': k, 'Value': v}
                for k, v in summary.items()
                if not isinstance(v, dict)
            ])
            summary_df.to_excel(writer, sheet_name='Summary', index=False)

            # Line items
            items_data = []
            for item in self.items.values():
                items_data.append({
                    'Code': item.item_code,
                    'Description': item.description,
                    'Category': item.category.value,
                    'Budget': item.current_budget,
                    'Committed': item.committed_cost,
                    'Actual': item.actual_cost,
                    'Forecast': item.forecast_cost,
                    'Variance $': item.variance_amount,
                    'Variance %': round(item.variance_percent, 1),
                    'Status': item.status.value,
                    '% Complete': item.percent_complete
                })

            pd.DataFrame(items_data).to_excel(writer, sheet_name='Line Items', index=False)

            # Variance records
            if self.variance_records:
                records_df = pd.DataFrame([{
                    'ID': r.record_id,
                    'Item': r.item_code,
                    'Amount': r.variance_amount,
                    'Cause': r.cause.value,
                    'Explanation': r.explanation,
                    'Date': r.recorded_date,
                    'By': r.recorded_by
                } for r in self.variance_records])
                records_df.to_excel(writer, sheet_name='Variance Records', index=False)

        return output_path
```

## Quick Start

```python
# Initialize analyzer
analyzer = BudgetVarianceAnalyzer(
    project_name="Office Tower",
    original_budget=50000000,
    currency="USD"
)

# Add budget items
analyzer.add_budget_item("01-SITE", "Site Work", CostCategory.SUBCONTRACTOR, 2000000)
analyzer.add_budget_item("03-CONC", "Concrete", CostCategory.SUBCONTRACTOR, 8000000)
analyzer.add_budget_item("05-STEEL", "Structural Steel", CostCategory.SUBCONTRACTOR, 6000000)

# Update with actuals
analyzer.update_costs("03-CONC", committed=8500000, actual=4000000, percent_complete=45)

# Get summary
summary = analyzer.calculate_summary()
print(f"Variance: ${summary['variance']:,.0f} ({summary['variance_percent']}%)")
```

## Common Use Cases

### 1. Monthly Cost Review
```python
summary = analyzer.calculate_summary()
critical = analyzer.get_critical_items()
print(f"Items needing attention: {len(critical)}")
```

### 2. Record Variance Cause
```python
analyzer.record_variance(
    item_code="03-CONC",
    cause=VarianceCause.PRICE_ESCALATION,
    explanation="Steel rebar prices increased 15%",
    recorded_by="Cost Manager"
)
```

### 3. Forecast Scenarios
```python
scenarios = analyzer.forecast_completion()
for name, scenario in scenarios.items():
    print(f"{scenario.name}: ${scenario.total_forecast:,.0f}")
```

## Resources
- **Jens Book**: Chapter 3.1 - Cost Management
- **Reference**: PMI Cost Management


---


# Cash Flow Forecaster

## Business Case

### Problem Statement
Poor cash flow management causes issues:
- Insufficient funds for payments
- Missed early payment discounts
- Inaccurate financial projections
- Difficulty in financing negotiations

### Solution
Generate cash flow forecasts from schedule and cost data, including S-curve projections and payment timing analysis.

### Business Value
- **Financial planning** - Accurate funding requirements
- **Vendor relations** - Timely payments
- **Financing** - Support loan draw schedules
- **Decision support** - Cash position awareness

## Technical Implementation

```python
import pandas as pd
import numpy as np
from datetime import datetime, date, timedelta
from typing import Dict, Any, List, Optional, Tuple
from dataclasses import dataclass, field
from enum import Enum


class CashFlowType(Enum):
    """Cash flow types."""
    INFLOW = "inflow"
    OUTFLOW = "outflow"


class PaymentTerms(Enum):
    """Standard payment terms."""
    NET_30 = 30
    NET_45 = 45
    NET_60 = 60
    NET_90 = 90
    MILESTONE = 0
    PROGRESS = 0


@dataclass
class CostItem:
    """Cost item for cash flow."""
    item_id: str
    description: str
    total_amount: float
    start_date: date
    end_date: date
    payment_terms: PaymentTerms
    distribution: str = "linear"  # linear, front_loaded, back_loaded, s_curve
    retention_percent: float = 0.10
    category: str = ""


@dataclass
class PaymentSchedule:
    """Scheduled payment."""
    payment_id: str
    item_id: str
    description: str
    amount: float
    due_date: date
    payment_type: CashFlowType
    is_retention: bool = False
    paid: bool = False
    paid_date: Optional[date] = None


@dataclass
class CashFlowPeriod:
    """Cash flow for a period."""
    period_start: date
    period_end: date
    inflows: float
    outflows: float
    net_cash_flow: float
    cumulative_cash_flow: float
    opening_balance: float
    closing_balance: float


class CashFlowForecaster:
    """Forecast project cash flow."""

    def __init__(self, project_name: str, project_start: date, project_end: date,
                 initial_balance: float = 0, currency: str = "USD"):
        self.project_name = project_name
        self.project_start = project_start
        self.project_end = project_end
        self.initial_balance = initial_balance
        self.currency = currency
        self.cost_items: List[CostItem] = []
        self.revenue_items: List[CostItem] = []
        self.payments: List[PaymentSchedule] = []
        self._payment_counter = 0

    def add_cost_item(self, item_id: str, description: str, total_amount: float,
                     start_date: date, end_date: date,
                     payment_terms: PaymentTerms = PaymentTerms.NET_30,
                     distribution: str = "linear",
                     retention: float = 0.10,
                     category: str = "") -> CostItem:
        """Add cost item (outflow)."""
        item = CostItem(
            item_id=item_id,
            description=description,
            total_amount=total_amount,
            start_date=start_date,
            end_date=end_date,
            payment_terms=payment_terms,
            distribution=distribution,
            retention_percent=retention,
            category=category
        )
        self.cost_items.append(item)
        return item

    def add_revenue_item(self, item_id: str, description: str, total_amount: float,
                        start_date: date, end_date: date,
                        payment_terms: PaymentTerms = PaymentTerms.NET_30,
                        distribution: str = "linear",
                        retention: float = 0.10) -> CostItem:
        """Add revenue item (inflow)."""
        item = CostItem(
            item_id=item_id,
            description=description,
            total_amount=total_amount,
            start_date=start_date,
            end_date=end_date,
            payment_terms=payment_terms,
            distribution=distribution,
            retention_percent=retention
        )
        self.revenue_items.append(item)
        return item

    def _distribute_amount(self, total: float, start: date, end: date,
                          distribution: str, periods: int) -> List[float]:
        """Distribute amount over periods based on distribution type."""
        if periods <= 0:
            return [total]

        if distribution == "linear":
            return [total / periods] * periods
        elif distribution == "front_loaded":
            # More at the beginning
            weights = [periods - i for i in range(periods)]
            total_weight = sum(weights)
            return [total * w / total_weight for w in weights]
        elif distribution == "back_loaded":
            # More at the end
            weights = [i + 1 for i in range(periods)]
            total_weight = sum(weights)
            return [total * w / total_weight for w in weights]
        elif distribution == "s_curve":
            # S-curve distribution
            x = np.linspace(-3, 3, periods)
            weights = 1 / (1 + np.exp(-x))
            weights = weights / weights.sum()
            return [total * w for w in weights]
        else:
            return [total / periods] * periods

    def generate_payment_schedule(self, period_type: str = "monthly") -> List[PaymentSchedule]:
        """Generate payment schedule from cost items."""
        self.payments = []

        # Process cost items (outflows)
        for item in self.cost_items:
            self._generate_item_payments(item, CashFlowType.OUTFLOW, period_type)

        # Process revenue items (inflows)
        for item in self.revenue_items:
            self._generate_item_payments(item, CashFlowType.INFLOW, period_type)

        return sorted(self.payments, key=lambda x: x.due_date)

    def _generate_item_payments(self, item: CostItem, flow_type: CashFlowType,
                               period_type: str):
        """Generate payments for a single item."""
        # Calculate number of periods
        if period_type == "monthly":
            months = (item.end_date.year - item.start_date.year) * 12 + \
                    (item.end_date.month - item.start_date.month) + 1
            periods = max(1, months)
        else:  # weekly
            days = (item.end_date - item.start_date).days
            periods = max(1, days // 7)

        # Distribute amount
        net_amount = item.total_amount * (1 - item.retention_percent)
        amounts = self._distribute_amount(net_amount, item.start_date, item.end_date,
                                         item.distribution, periods)

        # Create payments
        current_date = item.start_date
        for i, amount in enumerate(amounts):
            # Calculate payment due date based on terms
            if item.payment_terms == PaymentTerms.MILESTONE:
                due_date = current_date
            else:
                due_date = current_date + timedelta(days=item.payment_terms.value)

            self._payment_counter += 1
            payment = PaymentSchedule(
                payment_id=f"PAY-{self._payment_counter:05d}",
                item_id=item.item_id,
                description=f"{item.description} - Period {i+1}",
                amount=amount,
                due_date=due_date,
                payment_type=flow_type
            )
            self.payments.append(payment)

            # Move to next period
            if period_type == "monthly":
                if current_date.month == 12:
                    current_date = date(current_date.year + 1, 1, current_date.day)
                else:
                    try:
                        current_date = date(current_date.year, current_date.month + 1, current_date.day)
                    except ValueError:
                        # Handle months with fewer days
                        current_date = date(current_date.year, current_date.month + 1, 28)
            else:
                current_date += timedelta(days=7)

        # Add retention release at project end
        if item.retention_percent > 0:
            retention_amount = item.total_amount * item.retention_percent
            self._payment_counter += 1
            retention_payment = PaymentSchedule(
                payment_id=f"PAY-{self._payment_counter:05d}",
                item_id=item.item_id,
                description=f"{item.description} - Retention Release",
                amount=retention_amount,
                due_date=self.project_end + timedelta(days=60),
                payment_type=flow_type,
                is_retention=True
            )
            self.payments.append(retention_payment)

    def generate_cash_flow_forecast(self, period_type: str = "monthly") -> List[CashFlowPeriod]:
        """Generate cash flow forecast."""
        if not self.payments:
            self.generate_payment_schedule(period_type)

        # Group payments by period
        periods = []
        current_date = self.project_start
        cumulative = 0
        balance = self.initial_balance

        while current_date <= self.project_end + timedelta(days=90):
            # Calculate period end
            if period_type == "monthly":
                if current_date.month == 12:
                    period_end = date(current_date.year + 1, 1, 1) - timedelta(days=1)
                else:
                    period_end = date(current_date.year, current_date.month + 1, 1) - timedelta(days=1)
            else:
                period_end = current_date + timedelta(days=6)

            # Filter payments for this period
            period_payments = [p for p in self.payments
                             if current_date <= p.due_date <= period_end]

            inflows = sum(p.amount for p in period_payments
                        if p.payment_type == CashFlowType.INFLOW)
            outflows = sum(p.amount for p in period_payments
                         if p.payment_type == CashFlowType.OUTFLOW)
            net = inflows - outflows
            cumulative += net

            period = CashFlowPeriod(
                period_start=current_date,
                period_end=period_end,
                inflows=inflows,
                outflows=outflows,
                net_cash_flow=net,
                cumulative_cash_flow=cumulative,
                opening_balance=balance,
                closing_balance=balance + net
            )
            periods.append(period)

            balance = period.closing_balance

            # Move to next period
            current_date = period_end + timedelta(days=1)

        return periods

    def generate_s_curve(self) -> pd.DataFrame:
        """Generate S-curve data (cumulative costs over time)."""
        forecast = self.generate_cash_flow_forecast()

        # Costs only (outflows)
        data = []
        cumulative_cost = 0
        total_cost = sum(item.total_amount for item in self.cost_items)

        for period in forecast:
            cumulative_cost += period.outflows
            percent_complete = (cumulative_cost / total_cost * 100) if total_cost > 0 else 0

            data.append({
                'date': period.period_end,
                'period_cost': period.outflows,
                'cumulative_cost': cumulative_cost,
                'percent_complete': round(percent_complete, 1),
                'total_budget': total_cost
            })

        return pd.DataFrame(data)

    def get_funding_requirements(self, buffer_percent: float = 0.10) -> Dict[str, Any]:
        """Calculate funding requirements."""
        forecast = self.generate_cash_flow_forecast()

        # Find peak negative cash flow
        min_balance = min(p.closing_balance for p in forecast)
        peak_funding = abs(min(0, min_balance))

        # Add buffer
        required_funding = peak_funding * (1 + buffer_percent)

        # Monthly funding needs
        monthly_needs = []
        for period in forecast:
            if period.net_cash_flow < 0:
                monthly_needs.append({
                    'month': period.period_start.strftime('%Y-%m'),
                    'funding_needed': abs(period.net_cash_flow)
                })

        return {
            'peak_funding_required': round(required_funding, 2),
            'peak_funding_month': min(forecast, key=lambda x: x.closing_balance).period_start.strftime('%Y-%m'),
            'total_outflows': sum(p.outflows for p in forecast),
            'total_inflows': sum(p.inflows for p in forecast),
            'monthly_funding_needs': monthly_needs,
            'buffer_percent': buffer_percent
        }

    def export_forecast(self, output_path: str):
        """Export cash flow forecast to Excel."""
        forecast = self.generate_cash_flow_forecast()
        s_curve = self.generate_s_curve()

        with pd.ExcelWriter(output_path, engine='openpyxl') as writer:
            # Cash flow forecast
            forecast_df = pd.DataFrame([{
                'Period Start': p.period_start,
                'Period End': p.period_end,
                'Inflows': p.inflows,
                'Outflows': p.outflows,
                'Net Cash Flow': p.net_cash_flow,
                'Cumulative': p.cumulative_cash_flow,
                'Opening Balance': p.opening_balance,
                'Closing Balance': p.closing_balance
            } for p in forecast])
            forecast_df.to_excel(writer, sheet_name='Cash Flow', index=False)

            # S-curve
            s_curve.to_excel(writer, sheet_name='S-Curve', index=False)

            # Payment schedule
            payments_df = pd.DataFrame([{
                'ID': p.payment_id,
                'Item': p.item_id,
                'Description': p.description,
                'Amount': p.amount,
                'Due Date': p.due_date,
                'Type': p.payment_type.value,
                'Retention': p.is_retention
            } for p in self.payments])
            payments_df.to_excel(writer, sheet_name='Payments', index=False)

        return output_path
```

## Quick Start

```python
from datetime import date

# Initialize forecaster
forecaster = CashFlowForecaster(
    project_name="Office Tower",
    project_start=date(2024, 1, 1),
    project_end=date(2025, 12, 31),
    initial_balance=5000000
)

# Add costs
forecaster.add_cost_item("CONC", "Concrete Work", 8000000,
                         date(2024, 3, 1), date(2024, 9, 30),
                         distribution="s_curve")

# Add revenue
forecaster.add_revenue_item("DRAW", "Owner Draws", 50000000,
                            date(2024, 1, 1), date(2025, 12, 31),
                            distribution="s_curve")

# Generate forecast
forecast = forecaster.generate_cash_flow_forecast()
print(f"Peak cash requirement: ${min(p.closing_balance for p in forecast):,.0f}")
```

## Common Use Cases

### 1. S-Curve Analysis
```python
s_curve = forecaster.generate_s_curve()
# Plot cumulative cost over time
```

### 2. Funding Requirements
```python
funding = forecaster.get_funding_requirements(buffer_percent=0.15)
print(f"Required funding: ${funding['peak_funding_required']:,.0f}")
```

### 3. Export Report
```python
forecaster.export_forecast("cash_flow_forecast.xlsx")
```

## Resources
- **Jens Book**: Chapter 3.1 - Cost Management
- **Reference**: Project Financial Management


---


# Change Order Processor

## Business Case

### Problem Statement
Change orders cause project disruption:
- Delayed processing affects cash flow
- Unclear cost impact
- Lost documentation
- Schedule impacts not tracked

### Solution
Streamlined change order processing with cost analysis, approval workflow, and impact tracking.

### Business Value
- **Faster processing** - Reduce approval cycle time
- **Cost control** - Accurate change pricing
- **Documentation** - Complete audit trail
- **Impact visibility** - Schedule and budget effects

## Technical Implementation

```python
import pandas as pd
from datetime import datetime, date, timedelta
from typing import Dict, Any, List, Optional
from dataclasses import dataclass, field
from enum import Enum


class ChangeOrderStatus(Enum):
    """Change order status."""
    DRAFT = "draft"
    PENDING_REVIEW = "pending_review"
    PENDING_APPROVAL = "pending_approval"
    APPROVED = "approved"
    REJECTED = "rejected"
    VOID = "void"


class ChangeType(Enum):
    """Type of change."""
    OWNER_REQUESTED = "owner_requested"
    DESIGN_CHANGE = "design_change"
    FIELD_CONDITION = "field_condition"
    CODE_COMPLIANCE = "code_compliance"
    VALUE_ENGINEERING = "value_engineering"
    ERROR_OMISSION = "error_omission"


class ImpactType(Enum):
    """Impact categories."""
    COST_INCREASE = "cost_increase"
    COST_DECREASE = "cost_decrease"
    TIME_INCREASE = "time_increase"
    TIME_DECREASE = "time_decrease"
    NO_IMPACT = "no_impact"


@dataclass
class CostItem:
    """Change order cost item."""
    description: str
    quantity: float
    unit: str
    unit_cost: float
    total_cost: float
    category: str  # labor, material, equipment, subcontractor
    markup_percent: float = 0.0


@dataclass
class ApprovalRecord:
    """Approval workflow record."""
    approver_name: str
    approver_role: str
    action: str  # approved, rejected, returned
    action_date: datetime
    comments: str = ""


@dataclass
class ChangeOrder:
    """Change order record."""
    co_number: str
    title: str
    description: str
    change_type: ChangeType
    status: ChangeOrderStatus
    created_date: date
    created_by: str

    # Cost
    cost_items: List[CostItem] = field(default_factory=list)
    direct_cost: float = 0.0
    overhead_cost: float = 0.0
    profit_cost: float = 0.0
    total_cost: float = 0.0

    # Schedule
    schedule_impact_days: int = 0
    affected_activities: List[str] = field(default_factory=list)

    # Workflow
    approvals: List[ApprovalRecord] = field(default_factory=list)
    approved_date: Optional[date] = None
    approved_by: str = ""

    # References
    rfi_reference: str = ""
    spec_section: str = ""
    drawing_reference: str = ""
    location: str = ""

    def to_dict(self) -> Dict[str, Any]:
        return {
            'co_number': self.co_number,
            'title': self.title,
            'change_type': self.change_type.value,
            'status': self.status.value,
            'created_date': self.created_date.isoformat(),
            'direct_cost': self.direct_cost,
            'overhead_cost': self.overhead_cost,
            'profit_cost': self.profit_cost,
            'total_cost': self.total_cost,
            'schedule_impact': self.schedule_impact_days,
            'approved_date': self.approved_date.isoformat() if self.approved_date else None
        }


class ChangeOrderProcessor:
    """Process and manage change orders."""

    DEFAULT_OVERHEAD_RATE = 0.10
    DEFAULT_PROFIT_RATE = 0.10

    def __init__(self, project_name: str, original_contract: float,
                 overhead_rate: float = None, profit_rate: float = None):
        self.project_name = project_name
        self.original_contract = original_contract
        self.overhead_rate = overhead_rate or self.DEFAULT_OVERHEAD_RATE
        self.profit_rate = profit_rate or self.DEFAULT_PROFIT_RATE
        self.change_orders: Dict[str, ChangeOrder] = {}
        self._co_counter = 0

    def create_change_order(self,
                           title: str,
                           description: str,
                           change_type: ChangeType,
                           created_by: str,
                           rfi_reference: str = "",
                           location: str = "") -> ChangeOrder:
        """Create new change order."""
        self._co_counter += 1
        co_number = f"CO-{self._co_counter:04d}"

        co = ChangeOrder(
            co_number=co_number,
            title=title,
            description=description,
            change_type=change_type,
            status=ChangeOrderStatus.DRAFT,
            created_date=date.today(),
            created_by=created_by,
            rfi_reference=rfi_reference,
            location=location
        )

        self.change_orders[co_number] = co
        return co

    def add_cost_item(self, co_number: str,
                     description: str,
                     quantity: float,
                     unit: str,
                     unit_cost: float,
                     category: str,
                     markup_percent: float = 0.0):
        """Add cost item to change order."""
        if co_number not in self.change_orders:
            raise ValueError(f"Change order {co_number} not found")

        co = self.change_orders[co_number]

        total = quantity * unit_cost * (1 + markup_percent)
        item = CostItem(
            description=description,
            quantity=quantity,
            unit=unit,
            unit_cost=unit_cost,
            total_cost=total,
            category=category,
            markup_percent=markup_percent
        )

        co.cost_items.append(item)
        self._recalculate_totals(co)

    def _recalculate_totals(self, co: ChangeOrder):
        """Recalculate change order totals."""
        co.direct_cost = sum(item.total_cost for item in co.cost_items)
        co.overhead_cost = co.direct_cost * self.overhead_rate
        co.profit_cost = (co.direct_cost + co.overhead_cost) * self.profit_rate
        co.total_cost = co.direct_cost + co.overhead_cost + co.profit_cost

    def set_schedule_impact(self, co_number: str, days: int,
                           affected_activities: List[str] = None):
        """Set schedule impact."""
        if co_number not in self.change_orders:
            raise ValueError(f"Change order {co_number} not found")

        co = self.change_orders[co_number]
        co.schedule_impact_days = days
        co.affected_activities = affected_activities or []

    def submit_for_review(self, co_number: str):
        """Submit change order for review."""
        if co_number not in self.change_orders:
            raise ValueError(f"Change order {co_number} not found")

        co = self.change_orders[co_number]
        if co.status != ChangeOrderStatus.DRAFT:
            raise ValueError("Can only submit draft change orders")

        co.status = ChangeOrderStatus.PENDING_REVIEW

    def submit_for_approval(self, co_number: str, reviewer: str, comments: str = ""):
        """Submit for approval after review."""
        if co_number not in self.change_orders:
            raise ValueError(f"Change order {co_number} not found")

        co = self.change_orders[co_number]
        if co.status != ChangeOrderStatus.PENDING_REVIEW:
            raise ValueError("Must be in review status")

        co.approvals.append(ApprovalRecord(
            approver_name=reviewer,
            approver_role="Reviewer",
            action="reviewed",
            action_date=datetime.now(),
            comments=comments
        ))

        co.status = ChangeOrderStatus.PENDING_APPROVAL

    def approve_change_order(self, co_number: str, approver: str,
                            approver_role: str, comments: str = ""):
        """Approve change order."""
        if co_number not in self.change_orders:
            raise ValueError(f"Change order {co_number} not found")

        co = self.change_orders[co_number]

        co.approvals.append(ApprovalRecord(
            approver_name=approver,
            approver_role=approver_role,
            action="approved",
            action_date=datetime.now(),
            comments=comments
        ))

        co.status = ChangeOrderStatus.APPROVED
        co.approved_date = date.today()
        co.approved_by = approver

    def reject_change_order(self, co_number: str, rejector: str,
                           reason: str):
        """Reject change order."""
        if co_number not in self.change_orders:
            raise ValueError(f"Change order {co_number} not found")

        co = self.change_orders[co_number]

        co.approvals.append(ApprovalRecord(
            approver_name=rejector,
            approver_role="Approver",
            action="rejected",
            action_date=datetime.now(),
            comments=reason
        ))

        co.status = ChangeOrderStatus.REJECTED

    def get_summary(self) -> Dict[str, Any]:
        """Generate change order summary."""
        cos = list(self.change_orders.values())

        by_status = {}
        by_type = {}
        total_approved = 0
        total_pending = 0
        total_schedule_impact = 0

        for co in cos:
            # By status
            status = co.status.value
            by_status[status] = by_status.get(status, 0) + 1

            # By type
            change_type = co.change_type.value
            by_type[change_type] = by_type.get(change_type, 0) + co.total_cost

            # Totals
            if co.status == ChangeOrderStatus.APPROVED:
                total_approved += co.total_cost
                total_schedule_impact += co.schedule_impact_days
            elif co.status in [ChangeOrderStatus.PENDING_REVIEW, ChangeOrderStatus.PENDING_APPROVAL]:
                total_pending += co.total_cost

        current_contract = self.original_contract + total_approved

        return {
            'project': self.project_name,
            'original_contract': self.original_contract,
            'approved_changes': total_approved,
            'current_contract': current_contract,
            'pending_changes': total_pending,
            'potential_contract': current_contract + total_pending,
            'total_change_orders': len(cos),
            'by_status': by_status,
            'by_type': by_type,
            'total_schedule_impact_days': total_schedule_impact,
            'change_percent': round(total_approved / self.original_contract * 100, 1) if self.original_contract > 0 else 0
        }

    def get_pending_approvals(self) -> List[ChangeOrder]:
        """Get change orders pending approval."""
        return [co for co in self.change_orders.values()
                if co.status in [ChangeOrderStatus.PENDING_REVIEW, ChangeOrderStatus.PENDING_APPROVAL]]

    def export_log(self, output_path: str):
        """Export change order log to Excel."""
        with pd.ExcelWriter(output_path, engine='openpyxl') as writer:
            # Summary
            summary = self.get_summary()
            summary_df = pd.DataFrame([
                {'Metric': 'Original Contract', 'Value': summary['original_contract']},
                {'Metric': 'Approved Changes', 'Value': summary['approved_changes']},
                {'Metric': 'Current Contract', 'Value': summary['current_contract']},
                {'Metric': 'Pending Changes', 'Value': summary['pending_changes']},
                {'Metric': 'Change %', 'Value': f"{summary['change_percent']}%"},
                {'Metric': 'Schedule Impact (days)', 'Value': summary['total_schedule_impact_days']}
            ])
            summary_df.to_excel(writer, sheet_name='Summary', index=False)

            # Change order list
            co_data = [co.to_dict() for co in self.change_orders.values()]
            pd.DataFrame(co_data).to_excel(writer, sheet_name='Change Orders', index=False)

            # Cost details
            cost_data = []
            for co in self.change_orders.values():
                for item in co.cost_items:
                    cost_data.append({
                        'CO Number': co.co_number,
                        'Description': item.description,
                        'Quantity': item.quantity,
                        'Unit': item.unit,
                        'Unit Cost': item.unit_cost,
                        'Total': item.total_cost,
                        'Category': item.category
                    })
            if cost_data:
                pd.DataFrame(cost_data).to_excel(writer, sheet_name='Cost Details', index=False)

        return output_path
```

## Quick Start

```python
# Initialize processor
processor = ChangeOrderProcessor(
    project_name="Office Tower",
    original_contract=50000000
)

# Create change order
co = processor.create_change_order(
    title="Additional Electrical Outlets",
    description="Add 50 electrical outlets per owner request",
    change_type=ChangeType.OWNER_REQUESTED,
    created_by="Project Manager"
)

# Add cost items
processor.add_cost_item(co.co_number, "Electrical outlets", 50, "EA", 150, "material")
processor.add_cost_item(co.co_number, "Installation labor", 25, "HR", 85, "labor")

# Set schedule impact
processor.set_schedule_impact(co.co_number, days=5)

# Submit for approval
processor.submit_for_review(co.co_number)
```

## Common Use Cases

### 1. Process Approval
```python
processor.submit_for_approval(co.co_number, "Reviewer", "Cost verified")
processor.approve_change_order(co.co_number, "Owner Rep", "Owner", "Approved per request")
```

### 2. Get Summary
```python
summary = processor.get_summary()
print(f"Contract value: ${summary['current_contract']:,.0f}")
print(f"Change %: {summary['change_percent']}%")
```

### 3. Export Log
```python
processor.export_log("change_order_log.xlsx")
```

## Resources
- **Jens Book**: Chapter 3.1 - Cost Management
- **Reference**: AIA Document G701


---


# Material Delivery Tracker

## Business Case

### Problem Statement
Material logistics cause project delays:
- Missed deliveries impact schedule
- Storage space constraints
- No visibility into delivery status
- Difficult coordination with vendors

### Solution
Centralized material delivery tracking system that manages schedules, monitors status, and coordinates site logistics.

### Business Value
- **Schedule protection** - Timely material availability
- **Cost savings** - Reduce expediting fees
- **Site efficiency** - Optimized storage planning
- **Vendor coordination** - Better communication

## Technical Implementation

```python
import pandas as pd
from datetime import datetime, date, timedelta
from typing import Dict, Any, List, Optional
from dataclasses import dataclass, field
from enum import Enum


class DeliveryStatus(Enum):
    """Delivery status."""
    SCHEDULED = "scheduled"
    IN_TRANSIT = "in_transit"
    DELIVERED = "delivered"
    PARTIAL = "partial"
    DELAYED = "delayed"
    CANCELLED = "cancelled"


class DeliveryPriority(Enum):
    """Delivery priority."""
    CRITICAL = "critical"
    HIGH = "high"
    NORMAL = "normal"
    LOW = "low"


class MaterialCategory(Enum):
    """Material categories."""
    STRUCTURAL = "structural"
    CONCRETE = "concrete"
    MEP = "mep"
    FINISHES = "finishes"
    EQUIPMENT = "equipment"
    OTHER = "other"


@dataclass
class MaterialItem:
    """Material item in delivery."""
    item_id: str
    description: str
    quantity_ordered: float
    quantity_received: float
    unit: str
    category: MaterialCategory
    spec_section: str = ""
    notes: str = ""

    @property
    def is_complete(self) -> bool:
        return self.quantity_received >= self.quantity_ordered


@dataclass
class Delivery:
    """Material delivery record."""
    delivery_id: str
    po_number: str
    vendor: str
    vendor_contact: str
    vendor_phone: str
    scheduled_date: date
    priority: DeliveryPriority
    status: DeliveryStatus
    items: List[MaterialItem]
    delivery_location: str
    storage_area: str
    receiver: str = ""
    actual_date: Optional[date] = None
    tracking_number: str = ""
    carrier: str = ""
    notes: str = ""
    delay_reason: str = ""

    def to_dict(self) -> Dict[str, Any]:
        return {
            'delivery_id': self.delivery_id,
            'po_number': self.po_number,
            'vendor': self.vendor,
            'scheduled_date': self.scheduled_date.isoformat(),
            'actual_date': self.actual_date.isoformat() if self.actual_date else None,
            'status': self.status.value,
            'priority': self.priority.value,
            'items_count': len(self.items),
            'location': self.delivery_location,
            'storage': self.storage_area
        }


@dataclass
class StorageArea:
    """Site storage area."""
    area_id: str
    name: str
    location: str
    capacity_sqm: float
    current_usage_sqm: float
    material_types: List[str]
    is_covered: bool
    access_restrictions: str = ""


class MaterialDeliveryTracker:
    """Track material deliveries and logistics."""

    def __init__(self, project_name: str):
        self.project_name = project_name
        self.deliveries: Dict[str, Delivery] = {}
        self.storage_areas: Dict[str, StorageArea] = {}
        self._delivery_counter = 0

    def schedule_delivery(self,
                         po_number: str,
                         vendor: str,
                         scheduled_date: date,
                         delivery_location: str,
                         storage_area: str,
                         priority: DeliveryPriority = DeliveryPriority.NORMAL,
                         vendor_contact: str = "",
                         vendor_phone: str = "") -> Delivery:
        """Schedule new delivery."""
        self._delivery_counter += 1
        delivery_id = f"DEL-{self._delivery_counter:05d}"

        delivery = Delivery(
            delivery_id=delivery_id,
            po_number=po_number,
            vendor=vendor,
            vendor_contact=vendor_contact,
            vendor_phone=vendor_phone,
            scheduled_date=scheduled_date,
            priority=priority,
            status=DeliveryStatus.SCHEDULED,
            items=[],
            delivery_location=delivery_location,
            storage_area=storage_area
        )

        self.deliveries[delivery_id] = delivery
        return delivery

    def add_item(self, delivery_id: str,
                description: str,
                quantity: float,
                unit: str,
                category: MaterialCategory,
                spec_section: str = "") -> MaterialItem:
        """Add item to delivery."""
        if delivery_id not in self.deliveries:
            raise ValueError(f"Delivery {delivery_id} not found")

        delivery = self.deliveries[delivery_id]
        item_id = f"{delivery_id}-{len(delivery.items) + 1:03d}"

        item = MaterialItem(
            item_id=item_id,
            description=description,
            quantity_ordered=quantity,
            quantity_received=0,
            unit=unit,
            category=category,
            spec_section=spec_section
        )

        delivery.items.append(item)
        return item

    def update_status(self, delivery_id: str, status: DeliveryStatus,
                     tracking_number: str = "", carrier: str = "",
                     delay_reason: str = ""):
        """Update delivery status."""
        if delivery_id not in self.deliveries:
            raise ValueError(f"Delivery {delivery_id} not found")

        delivery = self.deliveries[delivery_id]
        delivery.status = status

        if tracking_number:
            delivery.tracking_number = tracking_number
        if carrier:
            delivery.carrier = carrier
        if delay_reason:
            delivery.delay_reason = delay_reason

    def receive_delivery(self, delivery_id: str, receiver: str,
                        received_quantities: Dict[str, float] = None,
                        actual_date: date = None):
        """Record delivery receipt."""
        if delivery_id not in self.deliveries:
            raise ValueError(f"Delivery {delivery_id} not found")

        delivery = self.deliveries[delivery_id]
        delivery.receiver = receiver
        delivery.actual_date = actual_date or date.today()

        # Update received quantities
        if received_quantities:
            for item in delivery.items:
                if item.item_id in received_quantities:
                    item.quantity_received = received_quantities[item.item_id]
        else:
            # Assume full receipt
            for item in delivery.items:
                item.quantity_received = item.quantity_ordered

        # Check if all items complete
        all_complete = all(item.is_complete for item in delivery.items)
        if all_complete:
            delivery.status = DeliveryStatus.DELIVERED
        else:
            delivery.status = DeliveryStatus.PARTIAL

    def add_storage_area(self, area_id: str, name: str, location: str,
                        capacity_sqm: float, material_types: List[str],
                        is_covered: bool = False) -> StorageArea:
        """Add storage area."""
        area = StorageArea(
            area_id=area_id,
            name=name,
            location=location,
            capacity_sqm=capacity_sqm,
            current_usage_sqm=0,
            material_types=material_types,
            is_covered=is_covered
        )
        self.storage_areas[area_id] = area
        return area

    def get_upcoming_deliveries(self, days: int = 7) -> List[Delivery]:
        """Get deliveries scheduled within specified days."""
        cutoff = date.today() + timedelta(days=days)
        return [d for d in self.deliveries.values()
                if d.status in [DeliveryStatus.SCHEDULED, DeliveryStatus.IN_TRANSIT]
                and d.scheduled_date <= cutoff]

    def get_delayed_deliveries(self) -> List[Delivery]:
        """Get overdue deliveries."""
        today = date.today()
        return [d for d in self.deliveries.values()
                if d.status in [DeliveryStatus.SCHEDULED, DeliveryStatus.IN_TRANSIT, DeliveryStatus.DELAYED]
                and d.scheduled_date < today]

    def get_deliveries_by_vendor(self, vendor: str) -> List[Delivery]:
        """Get all deliveries from a vendor."""
        return [d for d in self.deliveries.values()
                if vendor.lower() in d.vendor.lower()]

    def get_summary(self) -> Dict[str, Any]:
        """Generate delivery summary."""
        deliveries = list(self.deliveries.values())

        by_status = {}
        by_priority = {}
        by_vendor = {}

        for d in deliveries:
            status = d.status.value
            by_status[status] = by_status.get(status, 0) + 1

            priority = d.priority.value
            by_priority[priority] = by_priority.get(priority, 0) + 1

            by_vendor[d.vendor] = by_vendor.get(d.vendor, 0) + 1

        # Upcoming this week
        upcoming = self.get_upcoming_deliveries(7)
        delayed = self.get_delayed_deliveries()

        # On-time delivery rate
        completed = [d for d in deliveries if d.status == DeliveryStatus.DELIVERED]
        on_time = sum(1 for d in completed
                     if d.actual_date and d.actual_date <= d.scheduled_date)
        otd_rate = (on_time / len(completed) * 100) if completed else 0

        return {
            'project': self.project_name,
            'total_deliveries': len(deliveries),
            'by_status': by_status,
            'by_priority': by_priority,
            'by_vendor': by_vendor,
            'upcoming_7_days': len(upcoming),
            'overdue': len(delayed),
            'on_time_delivery_rate': round(otd_rate, 1),
            'storage_areas': len(self.storage_areas)
        }

    def export_schedule(self, output_path: str):
        """Export delivery schedule to Excel."""
        with pd.ExcelWriter(output_path, engine='openpyxl') as writer:
            # Delivery schedule
            schedule_data = [d.to_dict() for d in self.deliveries.values()]
            schedule_df = pd.DataFrame(schedule_data)
            if not schedule_df.empty:
                schedule_df.to_excel(writer, sheet_name='Schedule', index=False)

            # Item details
            items_data = []
            for delivery in self.deliveries.values():
                for item in delivery.items:
                    items_data.append({
                        'Delivery ID': delivery.delivery_id,
                        'PO': delivery.po_number,
                        'Item': item.description,
                        'Ordered': item.quantity_ordered,
                        'Received': item.quantity_received,
                        'Unit': item.unit,
                        'Category': item.category.value,
                        'Complete': item.is_complete
                    })
            if items_data:
                pd.DataFrame(items_data).to_excel(writer, sheet_name='Items', index=False)

            # Upcoming
            upcoming = self.get_upcoming_deliveries(14)
            if upcoming:
                upcoming_df = pd.DataFrame([d.to_dict() for d in upcoming])
                upcoming_df.to_excel(writer, sheet_name='Upcoming', index=False)

        return output_path
```

## Quick Start

```python
from datetime import date, timedelta

# Initialize tracker
tracker = MaterialDeliveryTracker("Office Tower")

# Schedule delivery
delivery = tracker.schedule_delivery(
    po_number="PO-2024-001",
    vendor="ABC Steel Supply",
    scheduled_date=date.today() + timedelta(days=7),
    delivery_location="Site Gate A",
    storage_area="Laydown Area 1",
    priority=DeliveryPriority.HIGH
)

# Add items
tracker.add_item(delivery.delivery_id, "W8x31 Beams", 50, "EA", MaterialCategory.STRUCTURAL)
tracker.add_item(delivery.delivery_id, "Connection Plates", 200, "EA", MaterialCategory.STRUCTURAL)

# Check upcoming
upcoming = tracker.get_upcoming_deliveries(7)
print(f"Deliveries this week: {len(upcoming)}")
```

## Common Use Cases

### 1. Update Transit Status
```python
tracker.update_status(delivery.delivery_id, DeliveryStatus.IN_TRANSIT,
                     tracking_number="TRACK123", carrier="XYZ Freight")
```

### 2. Receive Delivery
```python
tracker.receive_delivery(delivery.delivery_id, receiver="John Smith")
```

### 3. Monitor Delays
```python
delayed = tracker.get_delayed_deliveries()
for d in delayed:
    print(f"{d.delivery_id}: {d.vendor} - was due {d.scheduled_date}")
```

## Resources
- **Jens Book**: Chapter 3.4 - Procurement
- **Reference**: Materials Management


---


# Payment Application Generator

## Business Case

### Problem Statement
Payment applications are error-prone:
- Manual calculations cause mistakes
- Retention tracking is complex
- Inconsistent documentation
- Delayed submissions affect cash flow

### Solution
Automated payment application generation with schedule of values tracking, retention calculations, and standard format output.

### Business Value
- **Accuracy** - Eliminate calculation errors
- **Speed** - Faster billing cycle
- **Cash flow** - Timely payments
- **Compliance** - Standard documentation

## Technical Implementation

```python
import pandas as pd
from datetime import datetime, date
from typing import Dict, Any, List, Optional
from dataclasses import dataclass, field
from enum import Enum


class SOVStatus(Enum):
    """Schedule of Values item status."""
    NOT_STARTED = "not_started"
    IN_PROGRESS = "in_progress"
    COMPLETE = "complete"
    STORED_MATERIAL = "stored_material"


@dataclass
class SOVItem:
    """Schedule of Values line item."""
    item_number: str
    description: str
    scheduled_value: float
    work_completed_previous: float
    work_completed_current: float
    materials_stored_previous: float
    materials_stored_current: float
    total_completed_previous: float

    @property
    def total_completed_current(self) -> float:
        """Total completed and stored this period."""
        return (self.work_completed_previous + self.work_completed_current +
                self.materials_stored_previous + self.materials_stored_current)

    @property
    def percent_complete(self) -> float:
        """Percent of scheduled value complete."""
        if self.scheduled_value == 0:
            return 0
        return (self.total_completed_current / self.scheduled_value) * 100

    @property
    def balance_to_finish(self) -> float:
        """Remaining value."""
        return self.scheduled_value - self.total_completed_current


@dataclass
class PaymentApplication:
    """Payment application (AIA G702/G703 style)."""
    application_number: int
    period_from: date
    period_to: date
    project_name: str
    contractor: str
    owner: str
    contract_sum: float
    change_orders_amount: float
    retainage_percent: float

    items: List[SOVItem] = field(default_factory=list)
    approved_date: Optional[date] = None
    approved_by: str = ""

    @property
    def total_contract_sum(self) -> float:
        """Original contract plus approved changes."""
        return self.contract_sum + self.change_orders_amount

    @property
    def total_completed_this_period(self) -> float:
        """Work completed this billing period."""
        return sum(item.work_completed_current + item.materials_stored_current
                  for item in self.items)

    @property
    def total_completed_to_date(self) -> float:
        """Total completed and stored to date."""
        return sum(item.total_completed_current for item in self.items)

    @property
    def retainage_amount(self) -> float:
        """Total retainage held."""
        return self.total_completed_to_date * self.retainage_percent

    @property
    def total_earned_less_retainage(self) -> float:
        """Amount earned less retainage."""
        return self.total_completed_to_date - self.retainage_amount

    @property
    def balance_to_finish(self) -> float:
        """Remaining contract balance."""
        return self.total_contract_sum - self.total_completed_to_date


class PaymentApplicationGenerator:
    """Generate and manage payment applications."""

    DEFAULT_RETAINAGE = 0.10

    def __init__(self, project_name: str, contractor: str, owner: str,
                 original_contract: float, retainage: float = None):
        self.project_name = project_name
        self.contractor = contractor
        self.owner = owner
        self.original_contract = original_contract
        self.retainage_percent = retainage or self.DEFAULT_RETAINAGE
        self.sov_items: Dict[str, SOVItem] = {}
        self.applications: List[PaymentApplication] = []
        self.change_orders_total: float = 0

    def setup_sov(self, items: List[Dict[str, Any]]):
        """Initialize Schedule of Values."""
        for item in items:
            sov = SOVItem(
                item_number=item['number'],
                description=item['description'],
                scheduled_value=item['value'],
                work_completed_previous=0,
                work_completed_current=0,
                materials_stored_previous=0,
                materials_stored_current=0,
                total_completed_previous=0
            )
            self.sov_items[item['number']] = sov

    def add_change_order(self, amount: float, description: str, item_number: str = None):
        """Add approved change order to contract."""
        self.change_orders_total += amount

        if item_number:
            # Add to existing item
            if item_number in self.sov_items:
                self.sov_items[item_number].scheduled_value += amount
        else:
            # Create new line item
            new_number = f"CO-{len([i for i in self.sov_items if 'CO' in i]) + 1:02d}"
            self.sov_items[new_number] = SOVItem(
                item_number=new_number,
                description=f"Change Order: {description}",
                scheduled_value=amount,
                work_completed_previous=0,
                work_completed_current=0,
                materials_stored_previous=0,
                materials_stored_current=0,
                total_completed_previous=0
            )

    def create_application(self, period_from: date, period_to: date,
                          progress: Dict[str, Dict[str, float]]) -> PaymentApplication:
        """Create new payment application."""
        app_number = len(self.applications) + 1

        # Update progress for each item
        items_copy = []
        for item_num, sov in self.sov_items.items():
            # Carry forward previous values
            updated_sov = SOVItem(
                item_number=sov.item_number,
                description=sov.description,
                scheduled_value=sov.scheduled_value,
                work_completed_previous=sov.total_completed_current - sov.materials_stored_current,
                work_completed_current=0,
                materials_stored_previous=sov.materials_stored_current,
                materials_stored_current=0,
                total_completed_previous=sov.total_completed_current
            )

            # Apply current period progress
            if item_num in progress:
                prog = progress[item_num]
                if 'work' in prog:
                    updated_sov.work_completed_current = prog['work']
                if 'materials' in prog:
                    updated_sov.materials_stored_current = prog['materials']

            items_copy.append(updated_sov)

            # Update master SOV
            self.sov_items[item_num] = SOVItem(
                item_number=updated_sov.item_number,
                description=updated_sov.description,
                scheduled_value=updated_sov.scheduled_value,
                work_completed_previous=updated_sov.work_completed_previous + updated_sov.work_completed_current,
                work_completed_current=0,
                materials_stored_previous=updated_sov.materials_stored_previous + updated_sov.materials_stored_current,
                materials_stored_current=0,
                total_completed_previous=updated_sov.total_completed_current
            )

        application = PaymentApplication(
            application_number=app_number,
            period_from=period_from,
            period_to=period_to,
            project_name=self.project_name,
            contractor=self.contractor,
            owner=self.owner,
            contract_sum=self.original_contract,
            change_orders_amount=self.change_orders_total,
            retainage_percent=self.retainage_percent,
            items=items_copy
        )

        self.applications.append(application)
        return application

    def calculate_payment_due(self, application: PaymentApplication,
                             previous_payments: float = None) -> Dict[str, float]:
        """Calculate payment due for application."""
        if previous_payments is None:
            # Calculate from previous applications
            previous_payments = sum(
                app.total_earned_less_retainage
                for app in self.applications[:-1]
            )

        current_payment = application.total_earned_less_retainage - previous_payments

        return {
            'total_completed_to_date': application.total_completed_to_date,
            'retainage_held': application.retainage_amount,
            'total_earned_less_retainage': application.total_earned_less_retainage,
            'previous_payments': previous_payments,
            'current_payment_due': current_payment,
            'balance_to_finish': application.balance_to_finish,
            'percent_complete': round(
                application.total_completed_to_date / application.total_contract_sum * 100, 1
            ) if application.total_contract_sum > 0 else 0
        }

    def generate_g702(self, application: PaymentApplication) -> Dict[str, Any]:
        """Generate AIA G702 Application summary."""
        payment = self.calculate_payment_due(application)

        return {
            'document': 'AIA Document G702',
            'application_number': application.application_number,
            'period_to': application.period_to.isoformat(),
            'project': application.project_name,
            'contractor': application.contractor,
            'owner': application.owner,
            'original_contract_sum': application.contract_sum,
            'net_change_orders': application.change_orders_amount,
            'contract_sum_to_date': application.total_contract_sum,
            'total_completed_to_date': payment['total_completed_to_date'],
            'retainage': {
                'percent': application.retainage_percent * 100,
                'amount': payment['retainage_held']
            },
            'total_earned_less_retainage': payment['total_earned_less_retainage'],
            'previous_certificates': payment['previous_payments'],
            'current_payment_due': payment['current_payment_due'],
            'balance_to_finish': payment['balance_to_finish']
        }

    def generate_g703(self, application: PaymentApplication) -> pd.DataFrame:
        """Generate AIA G703 Continuation Sheet."""
        data = []
        for item in application.items:
            data.append({
                'Item No.': item.item_number,
                'Description': item.description,
                'Scheduled Value': item.scheduled_value,
                'Work Completed - Previous': item.work_completed_previous,
                'Work Completed - This Period': item.work_completed_current,
                'Materials Stored - Previous': item.materials_stored_previous,
                'Materials Stored - This Period': item.materials_stored_current,
                'Total Completed & Stored': item.total_completed_current,
                '% Complete': round(item.percent_complete, 1),
                'Balance to Finish': item.balance_to_finish,
                'Retainage': item.total_completed_current * application.retainage_percent
            })

        # Add totals row
        df = pd.DataFrame(data)
        totals = df.select_dtypes(include='number').sum()
        totals['Item No.'] = ''
        totals['Description'] = 'TOTALS'
        totals['% Complete'] = round(
            application.total_completed_to_date / application.total_contract_sum * 100, 1
        ) if application.total_contract_sum > 0 else 0

        df = pd.concat([df, pd.DataFrame([totals])], ignore_index=True)
        return df

    def export_application(self, application: PaymentApplication, output_path: str):
        """Export payment application to Excel."""
        with pd.ExcelWriter(output_path, engine='openpyxl') as writer:
            # G702 Summary
            g702 = self.generate_g702(application)
            g702_df = pd.DataFrame([{'Field': k, 'Value': v} for k, v in g702.items()
                                   if not isinstance(v, dict)])
            g702_df.to_excel(writer, sheet_name='G702 Summary', index=False)

            # G703 Continuation
            g703 = self.generate_g703(application)
            g703.to_excel(writer, sheet_name='G703 Continuation', index=False)

        return output_path
```

## Quick Start

```python
from datetime import date

# Initialize generator
generator = PaymentApplicationGenerator(
    project_name="Office Tower",
    contractor="ABC Construction",
    owner="XYZ Development",
    original_contract=10000000,
    retainage=0.10
)

# Setup Schedule of Values
generator.setup_sov([
    {'number': '01', 'description': 'General Conditions', 'value': 500000},
    {'number': '02', 'description': 'Site Work', 'value': 800000},
    {'number': '03', 'description': 'Concrete', 'value': 2000000},
])

# Create application with progress
app = generator.create_application(
    period_from=date(2024, 1, 1),
    period_to=date(2024, 1, 31),
    progress={
        '01': {'work': 50000},
        '02': {'work': 200000, 'materials': 50000},
        '03': {'work': 100000}
    }
)

# Calculate payment
payment = generator.calculate_payment_due(app)
print(f"Current Payment Due: ${payment['current_payment_due']:,.2f}")
```

## Common Use Cases

### 1. Generate G702/G703
```python
g702 = generator.generate_g702(app)
g703 = generator.generate_g703(app)
```

### 2. Export Application
```python
generator.export_application(app, "pay_app_001.xlsx")
```

### 3. Add Change Order
```python
generator.add_change_order(150000, "Additional MEP work", item_number='03')
```

## Resources
- **Jens Book**: Chapter 3.1 - Cost Management
- **Reference**: AIA Documents G702, G703


---


# Subcontractor Payment Tracker

## Business Case

### Problem Statement
Subcontractor payments require careful management:
- Complex payment schedules
- Lien waiver tracking
- Compliance documentation
- Cash flow coordination

### Solution
Comprehensive subcontractor payment tracking with lien waiver management, compliance monitoring, and payment scheduling.

## Technical Implementation

```python
import pandas as pd
from datetime import datetime, date, timedelta
from typing import Dict, Any, List, Optional
from dataclasses import dataclass, field
from enum import Enum


class PaymentStatus(Enum):
    SCHEDULED = "scheduled"
    INVOICED = "invoiced"
    APPROVED = "approved"
    PAID = "paid"
    HELD = "held"
    DISPUTED = "disputed"


class WaiverType(Enum):
    CONDITIONAL_PROGRESS = "conditional_progress"
    UNCONDITIONAL_PROGRESS = "unconditional_progress"
    CONDITIONAL_FINAL = "conditional_final"
    UNCONDITIONAL_FINAL = "unconditional_final"


@dataclass
class LienWaiver:
    waiver_id: str
    waiver_type: WaiverType
    through_date: date
    amount: float
    received_date: Optional[date]
    file_path: str = ""


@dataclass
class SubcontractorPayment:
    payment_id: str
    subcontractor_id: str
    invoice_number: str
    invoice_date: date
    amount: float
    retention_held: float
    status: PaymentStatus
    scheduled_date: date
    paid_date: Optional[date] = None
    check_number: str = ""
    lien_waiver: Optional[LienWaiver] = None
    notes: str = ""


@dataclass
class Subcontractor:
    sub_id: str
    company_name: str
    contact_name: str
    email: str
    phone: str
    contract_amount: float
    retention_percent: float
    trade: str
    payments: List[SubcontractorPayment] = field(default_factory=list)
    insurance_expiry: Optional[date] = None
    license_number: str = ""

    @property
    def total_paid(self) -> float:
        return sum(p.amount for p in self.payments if p.status == PaymentStatus.PAID)

    @property
    def total_retention(self) -> float:
        return sum(p.retention_held for p in self.payments)

    @property
    def balance_remaining(self) -> float:
        return self.contract_amount - self.total_paid - self.total_retention


class SubcontractorPaymentTracker:
    """Track subcontractor payments and compliance."""

    def __init__(self, project_name: str):
        self.project_name = project_name
        self.subcontractors: Dict[str, Subcontractor] = {}
        self._payment_counter = 0

    def add_subcontractor(self, company_name: str, contact_name: str, email: str,
                         phone: str, contract_amount: float, trade: str,
                         retention_percent: float = 0.10) -> Subcontractor:
        sub_id = f"SUB-{len(self.subcontractors) + 1:03d}"
        sub = Subcontractor(
            sub_id=sub_id,
            company_name=company_name,
            contact_name=contact_name,
            email=email,
            phone=phone,
            contract_amount=contract_amount,
            retention_percent=retention_percent,
            trade=trade
        )
        self.subcontractors[sub_id] = sub
        return sub

    def record_invoice(self, sub_id: str, invoice_number: str, invoice_date: date,
                      gross_amount: float, scheduled_date: date = None) -> SubcontractorPayment:
        if sub_id not in self.subcontractors:
            raise ValueError(f"Subcontractor {sub_id} not found")

        sub = self.subcontractors[sub_id]
        self._payment_counter += 1

        retention = gross_amount * sub.retention_percent
        net_amount = gross_amount - retention

        payment = SubcontractorPayment(
            payment_id=f"PAY-{self._payment_counter:05d}",
            subcontractor_id=sub_id,
            invoice_number=invoice_number,
            invoice_date=invoice_date,
            amount=net_amount,
            retention_held=retention,
            status=PaymentStatus.INVOICED,
            scheduled_date=scheduled_date or invoice_date + timedelta(days=30)
        )
        sub.payments.append(payment)
        return payment

    def approve_payment(self, payment_id: str, sub_id: str):
        sub = self.subcontractors.get(sub_id)
        if not sub:
            return
        for payment in sub.payments:
            if payment.payment_id == payment_id:
                payment.status = PaymentStatus.APPROVED
                break

    def record_payment(self, payment_id: str, sub_id: str, check_number: str,
                      paid_date: date = None):
        sub = self.subcontractors.get(sub_id)
        if not sub:
            return
        for payment in sub.payments:
            if payment.payment_id == payment_id:
                payment.status = PaymentStatus.PAID
                payment.paid_date = paid_date or date.today()
                payment.check_number = check_number
                break

    def attach_lien_waiver(self, payment_id: str, sub_id: str, waiver_type: WaiverType,
                          through_date: date, amount: float, received_date: date = None):
        sub = self.subcontractors.get(sub_id)
        if not sub:
            return
        for payment in sub.payments:
            if payment.payment_id == payment_id:
                waiver = LienWaiver(
                    waiver_id=f"LW-{payment_id}",
                    waiver_type=waiver_type,
                    through_date=through_date,
                    amount=amount,
                    received_date=received_date or date.today()
                )
                payment.lien_waiver = waiver
                break

    def get_pending_payments(self) -> List[Dict[str, Any]]:
        pending = []
        for sub in self.subcontractors.values():
            for payment in sub.payments:
                if payment.status in [PaymentStatus.INVOICED, PaymentStatus.APPROVED]:
                    pending.append({
                        'payment_id': payment.payment_id,
                        'subcontractor': sub.company_name,
                        'invoice': payment.invoice_number,
                        'amount': payment.amount,
                        'scheduled': payment.scheduled_date,
                        'status': payment.status.value,
                        'has_waiver': payment.lien_waiver is not None
                    })
        return sorted(pending, key=lambda x: x['scheduled'])

    def get_missing_waivers(self) -> List[Dict[str, Any]]:
        missing = []
        for sub in self.subcontractors.values():
            for payment in sub.payments:
                if payment.status == PaymentStatus.PAID and not payment.lien_waiver:
                    missing.append({
                        'subcontractor': sub.company_name,
                        'payment_id': payment.payment_id,
                        'amount': payment.amount,
                        'paid_date': payment.paid_date
                    })
        return missing

    def get_summary(self) -> Dict[str, Any]:
        total_contract = sum(s.contract_amount for s in self.subcontractors.values())
        total_paid = sum(s.total_paid for s in self.subcontractors.values())
        total_retention = sum(s.total_retention for s in self.subcontractors.values())

        return {
            'project': self.project_name,
            'total_subcontractors': len(self.subcontractors),
            'total_contract_value': total_contract,
            'total_paid': total_paid,
            'total_retention_held': total_retention,
            'remaining_to_pay': total_contract - total_paid - total_retention,
            'pending_payments': len(self.get_pending_payments()),
            'missing_waivers': len(self.get_missing_waivers())
        }

    def export_report(self, output_path: str):
        with pd.ExcelWriter(output_path, engine='openpyxl') as writer:
            # Summary by subcontractor
            sub_data = [{
                'ID': s.sub_id,
                'Company': s.company_name,
                'Trade': s.trade,
                'Contract': s.contract_amount,
                'Paid': s.total_paid,
                'Retention': s.total_retention,
                'Balance': s.balance_remaining
            } for s in self.subcontractors.values()]
            pd.DataFrame(sub_data).to_excel(writer, sheet_name='Subcontractors', index=False)

            # All payments
            pay_data = []
            for sub in self.subcontractors.values():
                for p in sub.payments:
                    pay_data.append({
                        'Payment ID': p.payment_id,
                        'Subcontractor': sub.company_name,
                        'Invoice': p.invoice_number,
                        'Amount': p.amount,
                        'Retention': p.retention_held,
                        'Status': p.status.value,
                        'Scheduled': p.scheduled_date,
                        'Paid': p.paid_date,
                        'Waiver': p.lien_waiver.waiver_type.value if p.lien_waiver else 'Missing'
                    })
            if pay_data:
                pd.DataFrame(pay_data).to_excel(writer, sheet_name='Payments', index=False)

        return output_path
```

## Quick Start

```python
tracker = SubcontractorPaymentTracker("Office Tower")

# Add subcontractor
sub = tracker.add_subcontractor(
    company_name="ABC Electrical",
    contact_name="John Smith",
    email="john@abcelectric.com",
    phone="555-1234",
    contract_amount=500000,
    trade="Electrical"
)

# Record invoice
payment = tracker.record_invoice(sub.sub_id, "INV-001", date.today(), 50000)

# Approve and pay
tracker.approve_payment(payment.payment_id, sub.sub_id)
tracker.record_payment(payment.payment_id, sub.sub_id, "CHK-12345")

# Attach waiver
tracker.attach_lien_waiver(payment.payment_id, sub.sub_id,
                          WaiverType.UNCONDITIONAL_PROGRESS, date.today(), 50000)
```

## Resources
- **Jens Book**: Chapter 3.1 - Cost Management


---

