# CWICR-Database Skills

Consolidated skill reference for CWICR-Database operations.

---

# CWICR Assembly Builder

## Business Case

### Problem Statement
Estimating repetitive elements requires:
- Consistent item groupings
- Reusable templates
- Standard assemblies
- Quick application

### Solution
Build and manage assemblies of CWICR work items that can be applied as templates to speed up estimating and ensure completeness.

### Business Value
- **Speed** - Apply complete assemblies quickly
- **Consistency** - Standard item groupings
- **Completeness** - No missed items
- **Reusability** - Template library

## Technical Implementation

```python
import pandas as pd
import json
from typing import Dict, Any, List, Optional
from dataclasses import dataclass, field
from enum import Enum
from datetime import datetime


class AssemblyType(Enum):
    """Types of assemblies."""
    STRUCTURAL = "structural"
    ARCHITECTURAL = "architectural"
    MECHANICAL = "mechanical"
    ELECTRICAL = "electrical"
    SITEWORK = "sitework"
    GENERAL = "general"


@dataclass
class AssemblyItem:
    """Single item in assembly."""
    work_item_code: str
    description: str
    quantity_per_unit: float  # Quantity per assembly unit
    unit: str
    unit_cost: float
    total_cost: float
    notes: str = ""


@dataclass
class Assembly:
    """Complete assembly definition."""
    assembly_code: str
    name: str
    description: str
    assembly_type: AssemblyType
    unit: str  # Assembly unit (e.g., "m2", "each", "LF")
    items: List[AssemblyItem]
    total_cost_per_unit: float
    labor_hours_per_unit: float
    created_date: datetime
    version: int = 1


class CWICRAssemblyBuilder:
    """Build and manage assemblies from CWICR data."""

    def __init__(self, cwicr_data: pd.DataFrame):
        self.cwicr = cwicr_data
        self._index_cwicr()
        self._assemblies: Dict[str, Assembly] = {}

    def _index_cwicr(self):
        """Index CWICR data."""
        if 'work_item_code' in self.cwicr.columns:
            self._cwicr_index = self.cwicr.set_index('work_item_code')
        else:
            self._cwicr_index = None

    def _get_item_cost(self, code: str) -> Tuple[float, float, str]:
        """Get item unit cost and labor hours."""
        if self._cwicr_index is None or code not in self._cwicr_index.index:
            return (0, 0, 'unit')

        item = self._cwicr_index.loc[code]
        labor = float(item.get('labor_cost', 0) or 0)
        material = float(item.get('material_cost', 0) or 0)
        equipment = float(item.get('equipment_cost', 0) or 0)
        labor_hours = float(item.get('labor_norm', item.get('labor_hours', 0)) or 0)
        unit = str(item.get('unit', 'unit'))

        return (labor + material + equipment, labor_hours, unit)

    def create_assembly(self,
                        assembly_code: str,
                        name: str,
                        description: str,
                        assembly_type: AssemblyType,
                        unit: str,
                        items: List[Dict[str, Any]]) -> Assembly:
        """Create new assembly from work items."""

        assembly_items = []
        total_cost = 0
        total_hours = 0

        for item_def in items:
            code = item_def.get('work_item_code', item_def.get('code'))
            qty_per_unit = item_def.get('quantity_per_unit', 1)
            notes = item_def.get('notes', '')

            unit_cost, labor_hours, item_unit = self._get_item_cost(code)

            # Get description from CWICR
            if self._cwicr_index is not None and code in self._cwicr_index.index:
                desc = str(self._cwicr_index.loc[code].get('description', code))
            else:
                desc = item_def.get('description', code)

            item_total = unit_cost * qty_per_unit

            assembly_items.append(AssemblyItem(
                work_item_code=code,
                description=desc,
                quantity_per_unit=qty_per_unit,
                unit=item_unit,
                unit_cost=round(unit_cost, 2),
                total_cost=round(item_total, 2),
                notes=notes
            ))

            total_cost += item_total
            total_hours += labor_hours * qty_per_unit

        assembly = Assembly(
            assembly_code=assembly_code,
            name=name,
            description=description,
            assembly_type=assembly_type,
            unit=unit,
            items=assembly_items,
            total_cost_per_unit=round(total_cost, 2),
            labor_hours_per_unit=round(total_hours, 2),
            created_date=datetime.now(),
            version=1
        )

        self._assemblies[assembly_code] = assembly
        return assembly

    def apply_assembly(self,
                        assembly_code: str,
                        quantity: float,
                        location_factor: float = 1.0) -> Dict[str, Any]:
        """Apply assembly to get estimate."""

        assembly = self._assemblies.get(assembly_code)
        if assembly is None:
            return {'error': f"Assembly {assembly_code} not found"}

        items = []
        total_cost = 0
        total_hours = 0

        for item in assembly.items:
            qty = item.quantity_per_unit * quantity
            cost = item.total_cost * quantity * location_factor
            hours = qty * (item.unit_cost / 50 if item.unit_cost > 0 else 0)  # Approximate labor hours

            items.append({
                'work_item_code': item.work_item_code,
                'description': item.description,
                'quantity': round(qty, 2),
                'unit': item.unit,
                'cost': round(cost, 2)
            })

            total_cost += cost
            total_hours += hours

        return {
            'assembly_code': assembly_code,
            'assembly_name': assembly.name,
            'quantity': quantity,
            'unit': assembly.unit,
            'location_factor': location_factor,
            'items': items,
            'total_cost': round(total_cost, 2),
            'total_labor_hours': round(total_hours, 2),
            'cost_per_unit': round(total_cost / quantity, 2) if quantity > 0 else 0
        }

    def get_assembly(self, assembly_code: str) -> Optional[Assembly]:
        """Get assembly by code."""
        return self._assemblies.get(assembly_code)

    def list_assemblies(self, assembly_type: AssemblyType = None) -> List[Dict[str, Any]]:
        """List all assemblies."""

        assemblies = self._assemblies.values()

        if assembly_type:
            assemblies = [a for a in assemblies if a.assembly_type == assembly_type]

        return [
            {
                'code': a.assembly_code,
                'name': a.name,
                'type': a.assembly_type.value,
                'unit': a.unit,
                'cost_per_unit': a.total_cost_per_unit,
                'item_count': len(a.items)
            }
            for a in assemblies
        ]

    def clone_assembly(self,
                        source_code: str,
                        new_code: str,
                        new_name: str = None) -> Optional[Assembly]:
        """Clone existing assembly."""

        source = self._assemblies.get(source_code)
        if source is None:
            return None

        new_assembly = Assembly(
            assembly_code=new_code,
            name=new_name or f"{source.name} (Copy)",
            description=source.description,
            assembly_type=source.assembly_type,
            unit=source.unit,
            items=source.items.copy(),
            total_cost_per_unit=source.total_cost_per_unit,
            labor_hours_per_unit=source.labor_hours_per_unit,
            created_date=datetime.now(),
            version=1
        )

        self._assemblies[new_code] = new_assembly
        return new_assembly

    def compare_assemblies(self,
                            codes: List[str],
                            quantity: float = 1) -> pd.DataFrame:
        """Compare multiple assemblies."""

        data = []

        for code in codes:
            assembly = self._assemblies.get(code)
            if assembly:
                result = self.apply_assembly(code, quantity)
                data.append({
                    'Assembly': assembly.name,
                    'Code': code,
                    'Unit': assembly.unit,
                    'Cost/Unit': assembly.total_cost_per_unit,
                    'Hours/Unit': assembly.labor_hours_per_unit,
                    f'Total ({quantity} {assembly.unit})': result['total_cost'],
                    'Items': len(assembly.items)
                })

        return pd.DataFrame(data)

    def create_standard_assemblies(self):
        """Create standard construction assemblies."""

        # Concrete slab assembly
        self.create_assembly(
            assembly_code="SLAB-100",
            name="Concrete Slab 100mm",
            description="Standard 100mm concrete slab on grade",
            assembly_type=AssemblyType.STRUCTURAL,
            unit="m2",
            items=[
                {'code': 'PREP-001', 'quantity_per_unit': 1.0, 'notes': 'Subgrade preparation'},
                {'code': 'GRAVEL-001', 'quantity_per_unit': 0.15, 'notes': '150mm gravel base'},
                {'code': 'VAPOR-001', 'quantity_per_unit': 1.1, 'notes': 'Vapor barrier'},
                {'code': 'MESH-001', 'quantity_per_unit': 1.1, 'notes': 'Welded wire mesh'},
                {'code': 'CONC-001', 'quantity_per_unit': 0.1, 'notes': '100mm concrete'},
                {'code': 'FINISH-001', 'quantity_per_unit': 1.0, 'notes': 'Power trowel finish'}
            ]
        )

        # Stud wall assembly
        self.create_assembly(
            assembly_code="WALL-STUD",
            name="Metal Stud Wall",
            description="Metal stud wall with drywall both sides",
            assembly_type=AssemblyType.ARCHITECTURAL,
            unit="m2",
            items=[
                {'code': 'TRACK-001', 'quantity_per_unit': 0.8, 'notes': 'Floor/ceiling track'},
                {'code': 'STUD-001', 'quantity_per_unit': 2.5, 'notes': 'Studs @ 400mm OC'},
                {'code': 'INSUL-001', 'quantity_per_unit': 1.0, 'notes': 'Batt insulation'},
                {'code': 'GYP-001', 'quantity_per_unit': 2.2, 'notes': 'Drywall both sides'},
                {'code': 'TAPE-001', 'quantity_per_unit': 2.0, 'notes': 'Tape and mud'}
            ]
        )

    def export_assemblies(self, output_path: str) -> str:
        """Export assemblies to Excel."""

        with pd.ExcelWriter(output_path, engine='openpyxl') as writer:
            # Summary
            summary_df = pd.DataFrame([
                {
                    'Code': a.assembly_code,
                    'Name': a.name,
                    'Type': a.assembly_type.value,
                    'Unit': a.unit,
                    'Cost/Unit': a.total_cost_per_unit,
                    'Hours/Unit': a.labor_hours_per_unit,
                    'Items': len(a.items),
                    'Version': a.version
                }
                for a in self._assemblies.values()
            ])
            summary_df.to_excel(writer, sheet_name='Assemblies', index=False)

            # Details for each assembly
            for code, assembly in self._assemblies.items():
                if len(code) > 25:
                    sheet_name = code[:25]
                else:
                    sheet_name = code

                detail_df = pd.DataFrame([
                    {
                        'Work Item': item.work_item_code,
                        'Description': item.description,
                        'Qty/Unit': item.quantity_per_unit,
                        'Item Unit': item.unit,
                        'Unit Cost': item.unit_cost,
                        'Total Cost': item.total_cost,
                        'Notes': item.notes
                    }
                    for item in assembly.items
                ])
                detail_df.to_excel(writer, sheet_name=sheet_name, index=False)

        return output_path

    def save_library(self, filepath: str):
        """Save assembly library to JSON."""
        data = {}

        for code, assembly in self._assemblies.items():
            data[code] = {
                'assembly_code': assembly.assembly_code,
                'name': assembly.name,
                'description': assembly.description,
                'assembly_type': assembly.assembly_type.value,
                'unit': assembly.unit,
                'items': [
                    {
                        'work_item_code': item.work_item_code,
                        'description': item.description,
                        'quantity_per_unit': item.quantity_per_unit,
                        'unit': item.unit,
                        'notes': item.notes
                    }
                    for item in assembly.items
                ],
                'version': assembly.version
            }

        with open(filepath, 'w') as f:
            json.dump(data, f, indent=2)
```

## Quick Start

```python
# Load CWICR data
cwicr = pd.read_parquet("ddc_cwicr_en.parquet")

# Initialize builder
builder = CWICRAssemblyBuilder(cwicr)

# Create assembly
builder.create_assembly(
    assembly_code="FDN-STRIP",
    name="Strip Foundation",
    description="Standard strip foundation 600x300",
    assembly_type=AssemblyType.STRUCTURAL,
    unit="LM",
    items=[
        {'code': 'EXCV-001', 'quantity_per_unit': 0.5},
        {'code': 'CONC-001', 'quantity_per_unit': 0.18},
        {'code': 'REBAR-001', 'quantity_per_unit': 15}
    ]
)

# Apply assembly
result = builder.apply_assembly("FDN-STRIP", quantity=50)
print(f"Total Cost: ${result['total_cost']:,.2f}")
```

## Common Use Cases

### 1. Standard Assemblies
```python
builder.create_standard_assemblies()
assemblies = builder.list_assemblies()
for a in assemblies:
    print(f"{a['code']}: ${a['cost_per_unit']:.2f}/{a['unit']}")
```

### 2. Compare Options
```python
comparison = builder.compare_assemblies(
    ["WALL-STUD", "WALL-BLOCK"],
    quantity=100
)
print(comparison)
```

### 3. Clone and Modify
```python
builder.clone_assembly("SLAB-100", "SLAB-150", "Concrete Slab 150mm")
```

## Resources
- **GitHub**: [OpenConstructionEstimate-Jens-CWICR](https://github.com/jens-construction/OpenConstructionEstimate-Jens-CWICR)
- **Jens Book**: Chapter 3.1 - Assembly-Based Estimating


---


# CWICR Bid Analyzer

## Business Case

### Problem Statement
Evaluating contractor bids requires:
- Comparing against market benchmarks
- Identifying unusual pricing
- Understanding cost composition
- Documenting evaluation rationale

### Solution
Analyze contractor bids against CWICR-based benchmarks to identify anomalies, compare components, and support objective bid evaluation.

### Business Value
- **Objective evaluation** - Data-driven bid analysis
- **Risk identification** - Spot unrealistic pricing
- **Fair comparison** - Normalized bid analysis
- **Documentation** - Audit trail for decisions

## Technical Implementation

```python
import pandas as pd
import numpy as np
from typing import Dict, Any, List, Optional, Tuple
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from collections import defaultdict


class BidStatus(Enum):
    """Bid evaluation status."""
    COMPLIANT = "compliant"
    NON_COMPLIANT = "non_compliant"
    UNDER_REVIEW = "under_review"
    RECOMMENDED = "recommended"
    NOT_RECOMMENDED = "not_recommended"


class PriceFlag(Enum):
    """Price anomaly flags."""
    NORMAL = "normal"
    LOW = "low"              # >20% below benchmark
    HIGH = "high"            # >20% above benchmark
    VERY_LOW = "very_low"    # >40% below - potential front-loading
    VERY_HIGH = "very_high"  # >40% above - potential profiteering


@dataclass
class BidLineItem:
    """Single line item from bid."""
    item_code: str
    description: str
    quantity: float
    unit: str
    unit_rate: float
    total_price: float
    benchmark_rate: float
    benchmark_total: float
    variance_pct: float
    price_flag: PriceFlag


@dataclass
class BidAnalysis:
    """Complete bid analysis."""
    bidder_name: str
    bid_total: float
    benchmark_total: float
    variance_pct: float
    line_items: List[BidLineItem]
    flagged_items: List[BidLineItem]
    status: BidStatus
    summary: Dict[str, Any]


@dataclass
class BidComparison:
    """Comparison of multiple bids."""
    project_name: str
    benchmark_total: float
    bids: List[BidAnalysis]
    ranking: List[Tuple[str, float]]
    recommended_bidder: Optional[str]


class CWICRBidAnalyzer:
    """Analyze bids against CWICR benchmarks."""

    # Thresholds for price flags
    LOW_THRESHOLD = -0.20
    HIGH_THRESHOLD = 0.20
    VERY_LOW_THRESHOLD = -0.40
    VERY_HIGH_THRESHOLD = 0.40

    def __init__(self, cwicr_data: pd.DataFrame):
        self.benchmark_data = cwicr_data
        self._index_data()

    def _index_data(self):
        """Index benchmark data."""
        if 'work_item_code' in self.benchmark_data.columns:
            self._code_index = self.benchmark_data.set_index('work_item_code')
        else:
            self._code_index = None

    def _get_price_flag(self, variance_pct: float) -> PriceFlag:
        """Determine price flag from variance."""
        if variance_pct <= self.VERY_LOW_THRESHOLD * 100:
            return PriceFlag.VERY_LOW
        elif variance_pct <= self.LOW_THRESHOLD * 100:
            return PriceFlag.LOW
        elif variance_pct >= self.VERY_HIGH_THRESHOLD * 100:
            return PriceFlag.VERY_HIGH
        elif variance_pct >= self.HIGH_THRESHOLD * 100:
            return PriceFlag.HIGH
        else:
            return PriceFlag.NORMAL

    def get_benchmark_rate(self, work_item_code: str) -> Optional[float]:
        """Get benchmark rate for work item."""
        if self._code_index is None:
            return None

        if work_item_code in self._code_index.index:
            item = self._code_index.loc[work_item_code]
            # Total unit rate
            labor = float(item.get('labor_cost', 0) or 0)
            material = float(item.get('material_cost', 0) or 0)
            equipment = float(item.get('equipment_cost', 0) or 0)
            return labor + material + equipment

        return None

    def analyze_bid(self,
                    bid_data: pd.DataFrame,
                    bidder_name: str,
                    code_column: str = 'item_code',
                    quantity_column: str = 'quantity',
                    rate_column: str = 'unit_rate',
                    total_column: str = 'total_price') -> BidAnalysis:
        """Analyze single bid against benchmarks."""

        line_items = []

        for _, row in bid_data.iterrows():
            code = row[code_column]
            qty = float(row[quantity_column])
            bid_rate = float(row[rate_column])
            bid_total = float(row.get(total_column, bid_rate * qty))

            benchmark_rate = self.get_benchmark_rate(code)
            if benchmark_rate is None:
                benchmark_rate = bid_rate  # No comparison possible

            benchmark_total = benchmark_rate * qty
            variance_pct = ((bid_rate - benchmark_rate) / benchmark_rate * 100) if benchmark_rate > 0 else 0

            line_items.append(BidLineItem(
                item_code=code,
                description=str(row.get('description', '')),
                quantity=qty,
                unit=str(row.get('unit', '')),
                unit_rate=bid_rate,
                total_price=bid_total,
                benchmark_rate=benchmark_rate,
                benchmark_total=benchmark_total,
                variance_pct=round(variance_pct, 1),
                price_flag=self._get_price_flag(variance_pct)
            ))

        # Totals
        bid_total = sum(item.total_price for item in line_items)
        benchmark_total = sum(item.benchmark_total for item in line_items)
        total_variance = ((bid_total - benchmark_total) / benchmark_total * 100) if benchmark_total > 0 else 0

        # Flagged items
        flagged = [item for item in line_items if item.price_flag != PriceFlag.NORMAL]

        # Determine status
        if len([f for f in flagged if f.price_flag in [PriceFlag.VERY_LOW, PriceFlag.VERY_HIGH]]) > len(line_items) * 0.1:
            status = BidStatus.UNDER_REVIEW
        elif total_variance < -30 or total_variance > 30:
            status = BidStatus.UNDER_REVIEW
        else:
            status = BidStatus.COMPLIANT

        # Summary statistics
        summary = {
            'total_items': len(line_items),
            'flagged_items': len(flagged),
            'items_below_benchmark': len([i for i in line_items if i.variance_pct < 0]),
            'items_above_benchmark': len([i for i in line_items if i.variance_pct > 0]),
            'average_variance': np.mean([i.variance_pct for i in line_items]),
            'max_overpriced': max([i.variance_pct for i in line_items]) if line_items else 0,
            'max_underpriced': min([i.variance_pct for i in line_items]) if line_items else 0
        }

        return BidAnalysis(
            bidder_name=bidder_name,
            bid_total=round(bid_total, 2),
            benchmark_total=round(benchmark_total, 2),
            variance_pct=round(total_variance, 1),
            line_items=line_items,
            flagged_items=flagged,
            status=status,
            summary=summary
        )

    def compare_bids(self,
                     bids: List[Tuple[str, pd.DataFrame]],
                     project_name: str = "Project") -> BidComparison:
        """Compare multiple bids."""

        analyses = []
        for bidder_name, bid_data in bids:
            analysis = self.analyze_bid(bid_data, bidder_name)
            analyses.append(analysis)

        # Get benchmark from first bid's items (they should be same scope)
        benchmark_total = analyses[0].benchmark_total if analyses else 0

        # Rank by total price
        ranking = sorted(
            [(a.bidder_name, a.bid_total) for a in analyses],
            key=lambda x: x[1]
        )

        # Recommend lowest compliant bidder
        recommended = None
        for bidder, total in ranking:
            bid_analysis = next(a for a in analyses if a.bidder_name == bidder)
            if bid_analysis.status == BidStatus.COMPLIANT:
                recommended = bidder
                bid_analysis.status = BidStatus.RECOMMENDED
                break

        return BidComparison(
            project_name=project_name,
            benchmark_total=benchmark_total,
            bids=analyses,
            ranking=ranking,
            recommended_bidder=recommended
        )

    def detect_front_loading(self, analysis: BidAnalysis) -> Dict[str, Any]:
        """Detect potential front-loading in bid."""

        # Front-loading: early items priced high, later items low
        # Simplified detection: look for pattern of high/low prices

        early_items = analysis.line_items[:len(analysis.line_items)//3]
        late_items = analysis.line_items[2*len(analysis.line_items)//3:]

        early_avg_variance = np.mean([i.variance_pct for i in early_items]) if early_items else 0
        late_avg_variance = np.mean([i.variance_pct for i in late_items]) if late_items else 0

        front_loading_indicator = early_avg_variance - late_avg_variance

        return {
            'early_items_variance': round(early_avg_variance, 1),
            'late_items_variance': round(late_avg_variance, 1),
            'front_loading_score': round(front_loading_indicator, 1),
            'potential_front_loading': front_loading_indicator > 20,
            'risk_level': 'High' if front_loading_indicator > 30 else 'Medium' if front_loading_indicator > 20 else 'Low'
        }

    def detect_unbalanced_bid(self, analysis: BidAnalysis) -> Dict[str, Any]:
        """Detect unbalanced bidding patterns."""

        variances = [item.variance_pct for item in analysis.line_items]

        # High standard deviation indicates unbalanced bid
        variance_std = np.std(variances) if variances else 0

        very_low_count = len([i for i in analysis.line_items if i.price_flag == PriceFlag.VERY_LOW])
        very_high_count = len([i for i in analysis.line_items if i.price_flag == PriceFlag.VERY_HIGH])

        return {
            'variance_spread': round(variance_std, 1),
            'very_low_items': very_low_count,
            'very_high_items': very_high_count,
            'unbalanced_score': very_low_count + very_high_count,
            'is_unbalanced': variance_std > 25 or (very_low_count + very_high_count) > len(analysis.line_items) * 0.15,
            'risk_level': 'High' if variance_std > 40 else 'Medium' if variance_std > 25 else 'Low'
        }

    def export_analysis(self,
                        analysis: BidAnalysis,
                        output_path: str) -> str:
        """Export bid analysis to Excel."""

        with pd.ExcelWriter(output_path, engine='openpyxl') as writer:
            # Summary
            summary_df = pd.DataFrame([{
                'Bidder': analysis.bidder_name,
                'Bid Total': analysis.bid_total,
                'Benchmark Total': analysis.benchmark_total,
                'Variance %': analysis.variance_pct,
                'Status': analysis.status.value,
                'Flagged Items': len(analysis.flagged_items)
            }])
            summary_df.to_excel(writer, sheet_name='Summary', index=False)

            # Line Items
            items_df = pd.DataFrame([
                {
                    'Item Code': i.item_code,
                    'Description': i.description,
                    'Quantity': i.quantity,
                    'Unit': i.unit,
                    'Bid Rate': i.unit_rate,
                    'Benchmark Rate': i.benchmark_rate,
                    'Bid Total': i.total_price,
                    'Benchmark Total': i.benchmark_total,
                    'Variance %': i.variance_pct,
                    'Flag': i.price_flag.value
                }
                for i in analysis.line_items
            ])
            items_df.to_excel(writer, sheet_name='Line Items', index=False)

            # Flagged Items
            flagged_df = pd.DataFrame([
                {
                    'Item Code': i.item_code,
                    'Description': i.description,
                    'Bid Rate': i.unit_rate,
                    'Benchmark Rate': i.benchmark_rate,
                    'Variance %': i.variance_pct,
                    'Flag': i.price_flag.value
                }
                for i in analysis.flagged_items
            ])
            flagged_df.to_excel(writer, sheet_name='Flagged Items', index=False)

        return output_path

    def export_comparison(self,
                          comparison: BidComparison,
                          output_path: str) -> str:
        """Export bid comparison to Excel."""

        with pd.ExcelWriter(output_path, engine='openpyxl') as writer:
            # Overview
            overview_df = pd.DataFrame([
                {
                    'Bidder': b.bidder_name,
                    'Bid Total': b.bid_total,
                    'Variance vs Benchmark %': b.variance_pct,
                    'Flagged Items': len(b.flagged_items),
                    'Status': b.status.value
                }
                for b in comparison.bids
            ])
            overview_df.to_excel(writer, sheet_name='Overview', index=False)

            # Ranking
            ranking_df = pd.DataFrame([
                {'Rank': i+1, 'Bidder': name, 'Total': total}
                for i, (name, total) in enumerate(comparison.ranking)
            ])
            ranking_df.to_excel(writer, sheet_name='Ranking', index=False)

        return output_path
```

## Quick Start

```python
# Load CWICR benchmarks
cwicr = pd.read_parquet("ddc_cwicr_en.parquet")

# Initialize analyzer
analyzer = CWICRBidAnalyzer(cwicr)

# Load bid
bid = pd.read_excel("contractor_bid.xlsx")

# Analyze
analysis = analyzer.analyze_bid(bid, "Contractor A")

print(f"Bid Total: ${analysis.bid_total:,.2f}")
print(f"Benchmark: ${analysis.benchmark_total:,.2f}")
print(f"Variance: {analysis.variance_pct}%")
print(f"Flagged Items: {len(analysis.flagged_items)}")
```

## Common Use Cases

### 1. Detect Front-Loading
```python
front_loading = analyzer.detect_front_loading(analysis)
if front_loading['potential_front_loading']:
    print(f"Warning: Potential front-loading detected (score: {front_loading['front_loading_score']})")
```

### 2. Compare Multiple Bids
```python
bids = [
    ("Contractor A", bid_a),
    ("Contractor B", bid_b),
    ("Contractor C", bid_c)
]
comparison = analyzer.compare_bids(bids, "Building Project")
print(f"Recommended: {comparison.recommended_bidder}")
```

### 3. Unbalanced Bid Detection
```python
unbalanced = analyzer.detect_unbalanced_bid(analysis)
if unbalanced['is_unbalanced']:
    print(f"Warning: Unbalanced bid detected (variance spread: {unbalanced['variance_spread']})")
```

### 4. Export Report
```python
analyzer.export_analysis(analysis, "bid_analysis.xlsx")
analyzer.export_comparison(comparison, "bid_comparison.xlsx")
```

## Resources
- **GitHub**: [OpenConstructionEstimate-Jens-CWICR](https://github.com/jens-construction/OpenConstructionEstimate-Jens-CWICR)
- **Jens Book**: Chapter 3.1 - Bid Analysis and Evaluation


---


# CWICR Change Order Processor

## Business Case

### Problem Statement
Change orders require:
- Quick cost impact analysis
- Comparison to original scope
- Fair pricing for added work
- Documentation for disputes

### Solution
Systematic change order processing using CWICR data to calculate fair costs, document changes, and analyze impact on project budget.

### Business Value
- **Fair pricing** - Based on validated norms
- **Quick turnaround** - Rapid cost analysis
- **Documentation** - Clear change records
- **Budget tracking** - Cumulative impact

## Technical Implementation

```python
import pandas as pd
from typing import Dict, Any, List, Optional
from dataclasses import dataclass, field
from datetime import datetime, date
from enum import Enum


class ChangeType(Enum):
    """Types of changes."""
    ADDITION = "addition"        # New work added
    DELETION = "deletion"        # Work removed
    MODIFICATION = "modification"  # Changed scope
    SUBSTITUTION = "substitution"  # Material/method change


class ChangeStatus(Enum):
    """Change order status."""
    DRAFT = "draft"
    SUBMITTED = "submitted"
    APPROVED = "approved"
    REJECTED = "rejected"
    PENDING = "pending"


@dataclass
class ChangeItem:
    """Single change item."""
    item_number: int
    work_item_code: str
    description: str
    change_type: ChangeType
    original_qty: float
    revised_qty: float
    unit: str
    unit_cost: float
    original_cost: float
    revised_cost: float
    cost_impact: float


@dataclass
class ChangeOrder:
    """Complete change order."""
    co_number: str
    project_name: str
    date_created: date
    status: ChangeStatus
    description: str
    items: List[ChangeItem]
    direct_cost_impact: float
    overhead_markup: float
    profit_markup: float
    total_impact: float
    schedule_impact_days: int
    justification: str


class CWICRChangeOrder:
    """Process change orders using CWICR data."""

    def __init__(self,
                 cwicr_data: pd.DataFrame,
                 overhead_rate: float = 0.12,
                 profit_rate: float = 0.08):
        self.cost_data = cwicr_data
        self.overhead_rate = overhead_rate
        self.profit_rate = profit_rate
        self._index_data()
        self._change_orders: Dict[str, ChangeOrder] = {}

    def _index_data(self):
        """Index cost data."""
        if 'work_item_code' in self.cost_data.columns:
            self._code_index = self.cost_data.set_index('work_item_code')
        else:
            self._code_index = None

    def get_unit_cost(self, code: str) -> Tuple[float, str]:
        """Get unit cost from CWICR."""
        if self._code_index is None or code not in self._code_index.index:
            return (0, 'unit')

        item = self._code_index.loc[code]
        labor = float(item.get('labor_cost', 0) or 0)
        material = float(item.get('material_cost', 0) or 0)
        equipment = float(item.get('equipment_cost', 0) or 0)
        unit = str(item.get('unit', 'unit'))

        return (labor + material + equipment, unit)

    def create_change_order(self,
                            co_number: str,
                            project_name: str,
                            description: str,
                            justification: str = "") -> str:
        """Create new change order."""

        co = ChangeOrder(
            co_number=co_number,
            project_name=project_name,
            date_created=date.today(),
            status=ChangeStatus.DRAFT,
            description=description,
            items=[],
            direct_cost_impact=0,
            overhead_markup=0,
            profit_markup=0,
            total_impact=0,
            schedule_impact_days=0,
            justification=justification
        )

        self._change_orders[co_number] = co
        return co_number

    def add_change_item(self,
                        co_number: str,
                        work_item_code: str,
                        change_type: ChangeType,
                        original_qty: float,
                        revised_qty: float,
                        description: str = None) -> ChangeItem:
        """Add item to change order."""

        co = self._change_orders.get(co_number)
        if co is None:
            raise ValueError(f"Change order {co_number} not found")

        unit_cost, unit = self.get_unit_cost(work_item_code)

        if description is None:
            if self._code_index is not None and work_item_code in self._code_index.index:
                description = str(self._code_index.loc[work_item_code].get('description', work_item_code))
            else:
                description = work_item_code

        original_cost = original_qty * unit_cost
        revised_cost = revised_qty * unit_cost
        cost_impact = revised_cost - original_cost

        item = ChangeItem(
            item_number=len(co.items) + 1,
            work_item_code=work_item_code,
            description=description,
            change_type=change_type,
            original_qty=original_qty,
            revised_qty=revised_qty,
            unit=unit,
            unit_cost=unit_cost,
            original_cost=round(original_cost, 2),
            revised_cost=round(revised_cost, 2),
            cost_impact=round(cost_impact, 2)
        )

        co.items.append(item)
        self._recalculate_totals(co_number)

        return item

    def _recalculate_totals(self, co_number: str):
        """Recalculate change order totals."""
        co = self._change_orders.get(co_number)
        if co is None:
            return

        direct_impact = sum(item.cost_impact for item in co.items)
        overhead = direct_impact * self.overhead_rate
        profit = (direct_impact + overhead) * self.profit_rate

        co.direct_cost_impact = round(direct_impact, 2)
        co.overhead_markup = round(overhead, 2)
        co.profit_markup = round(profit, 2)
        co.total_impact = round(direct_impact + overhead + profit, 2)

    def set_schedule_impact(self, co_number: str, days: int):
        """Set schedule impact for change order."""
        co = self._change_orders.get(co_number)
        if co:
            co.schedule_impact_days = days

    def update_status(self, co_number: str, status: ChangeStatus):
        """Update change order status."""
        co = self._change_orders.get(co_number)
        if co:
            co.status = status

    def get_change_order(self, co_number: str) -> Optional[ChangeOrder]:
        """Get change order by number."""
        return self._change_orders.get(co_number)

    def calculate_quick_impact(self,
                                changes: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Quick impact calculation without creating CO."""

        additions = 0
        deletions = 0
        modifications = 0

        for change in changes:
            code = change.get('work_item_code', change.get('code'))
            change_type = change.get('change_type', 'modification')
            original = change.get('original_qty', 0)
            revised = change.get('revised_qty', 0)

            unit_cost, _ = self.get_unit_cost(code)

            if change_type == 'addition':
                additions += revised * unit_cost
            elif change_type == 'deletion':
                deletions += original * unit_cost
            else:
                modifications += (revised - original) * unit_cost

        net_direct = additions - deletions + modifications
        overhead = net_direct * self.overhead_rate
        profit = (net_direct + overhead) * self.profit_rate

        return {
            'additions': round(additions, 2),
            'deletions': round(deletions, 2),
            'modifications': round(modifications, 2),
            'net_direct_impact': round(net_direct, 2),
            'overhead': round(overhead, 2),
            'profit': round(profit, 2),
            'total_impact': round(net_direct + overhead + profit, 2)
        }

    def compare_to_budget(self,
                          co_number: str,
                          original_budget: float,
                          approved_changes: float = 0) -> Dict[str, Any]:
        """Compare change order to project budget."""

        co = self._change_orders.get(co_number)
        if co is None:
            return {}

        current_budget = original_budget + approved_changes
        new_budget = current_budget + co.total_impact

        return {
            'original_budget': original_budget,
            'previously_approved_changes': approved_changes,
            'current_budget': current_budget,
            'this_change_order': co.total_impact,
            'new_budget': round(new_budget, 2),
            'change_from_original': round(new_budget - original_budget, 2),
            'change_percent': round((new_budget - original_budget) / original_budget * 100, 1)
        }

    def get_project_changes_summary(self,
                                     project_name: str) -> Dict[str, Any]:
        """Get summary of all changes for a project."""

        project_cos = [
            co for co in self._change_orders.values()
            if co.project_name == project_name
        ]

        total_additions = 0
        total_deletions = 0
        total_impact = 0
        total_schedule_impact = 0

        for co in project_cos:
            for item in co.items:
                if item.change_type == ChangeType.ADDITION:
                    total_additions += item.cost_impact
                elif item.change_type == ChangeType.DELETION:
                    total_deletions += abs(item.cost_impact)

            total_impact += co.total_impact
            total_schedule_impact += co.schedule_impact_days

        return {
            'project': project_name,
            'total_change_orders': len(project_cos),
            'approved': len([co for co in project_cos if co.status == ChangeStatus.APPROVED]),
            'pending': len([co for co in project_cos if co.status == ChangeStatus.PENDING]),
            'total_additions': round(total_additions, 2),
            'total_deletions': round(total_deletions, 2),
            'net_cost_impact': round(total_impact, 2),
            'total_schedule_days': total_schedule_impact
        }

    def export_change_order(self,
                             co_number: str,
                             output_path: str) -> str:
        """Export change order to Excel."""

        co = self._change_orders.get(co_number)
        if co is None:
            raise ValueError(f"Change order {co_number} not found")

        with pd.ExcelWriter(output_path, engine='openpyxl') as writer:
            # Header
            header_df = pd.DataFrame([{
                'Change Order': co.co_number,
                'Project': co.project_name,
                'Date': co.date_created,
                'Status': co.status.value,
                'Description': co.description,
                'Schedule Impact (days)': co.schedule_impact_days
            }])
            header_df.to_excel(writer, sheet_name='Summary', index=False)

            # Items
            items_df = pd.DataFrame([
                {
                    '#': item.item_number,
                    'Code': item.work_item_code,
                    'Description': item.description,
                    'Type': item.change_type.value,
                    'Original Qty': item.original_qty,
                    'Revised Qty': item.revised_qty,
                    'Unit': item.unit,
                    'Unit Cost': item.unit_cost,
                    'Original Cost': item.original_cost,
                    'Revised Cost': item.revised_cost,
                    'Impact': item.cost_impact
                }
                for item in co.items
            ])
            items_df.to_excel(writer, sheet_name='Items', index=False)

            # Totals
            totals_df = pd.DataFrame([{
                'Direct Cost Impact': co.direct_cost_impact,
                f'Overhead ({self.overhead_rate:.0%})': co.overhead_markup,
                f'Profit ({self.profit_rate:.0%})': co.profit_markup,
                'Total Impact': co.total_impact
            }])
            totals_df.to_excel(writer, sheet_name='Totals', index=False)

        return output_path
```

## Quick Start

```python
# Load CWICR data
cwicr = pd.read_parquet("ddc_cwicr_en.parquet")

# Initialize change order processor
co_processor = CWICRChangeOrder(cwicr, overhead_rate=0.12, profit_rate=0.08)

# Create change order
co_processor.create_change_order(
    co_number="CO-001",
    project_name="Building A",
    description="Additional foundation work due to soil conditions"
)

# Add items
co_processor.add_change_item(
    co_number="CO-001",
    work_item_code="EXCV-002",
    change_type=ChangeType.ADDITION,
    original_qty=0,
    revised_qty=150
)

# Get change order
co = co_processor.get_change_order("CO-001")
print(f"Direct Impact: ${co.direct_cost_impact:,.2f}")
print(f"Total Impact: ${co.total_impact:,.2f}")
```

## Common Use Cases

### 1. Quick Impact Analysis
```python
changes = [
    {'code': 'CONC-001', 'change_type': 'addition', 'original_qty': 0, 'revised_qty': 50},
    {'code': 'REBAR-002', 'change_type': 'modification', 'original_qty': 1000, 'revised_qty': 1500}
]

impact = co_processor.calculate_quick_impact(changes)
print(f"Net Impact: ${impact['total_impact']:,.2f}")
```

### 2. Compare to Budget
```python
comparison = co_processor.compare_to_budget(
    co_number="CO-001",
    original_budget=5000000,
    approved_changes=150000
)
print(f"Budget Change: {comparison['change_percent']}%")
```

### 3. Export Documentation
```python
co_processor.export_change_order("CO-001", "change_order_001.xlsx")
```

## Resources
- **GitHub**: [OpenConstructionEstimate-Jens-CWICR](https://github.com/jens-construction/OpenConstructionEstimate-Jens-CWICR)
- **Jens Book**: Chapter 3.2 - Change Order Management


---


# CWICR Comparison Tool

## Business Case

### Problem Statement
Project stakeholders need to compare:
- Alternative design options
- Estimate versions over time
- Projects against benchmarks
- Actual vs estimated costs

### Solution
Structured comparison of CWICR-based estimates with variance analysis, benchmarking, and visual reporting.

### Business Value
- **Decision support** - Compare alternatives objectively
- **Version control** - Track estimate evolution
- **Benchmarking** - Compare against standards
- **Audit** - Document estimate changes

## Technical Implementation

```python
import pandas as pd
import numpy as np
from typing import Dict, Any, List, Optional, Tuple
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum


class ComparisonType(Enum):
    """Types of comparisons."""
    VERSION = "version"          # Same project, different versions
    ALTERNATIVE = "alternative"  # Same project, design alternatives
    BENCHMARK = "benchmark"      # Project vs standard/benchmark
    ACTUAL = "actual"            # Estimate vs actual costs
    PROJECT = "project"          # Different projects


class VarianceSignificance(Enum):
    """Significance level of variance."""
    CRITICAL = "critical"    # >20% variance
    HIGH = "high"            # 10-20%
    MEDIUM = "medium"        # 5-10%
    LOW = "low"              # <5%
    NONE = "none"            # No variance


@dataclass
class ComparisonItem:
    """Single item comparison."""
    work_item_code: str
    description: str
    base_quantity: float
    base_cost: float
    compare_quantity: float
    compare_cost: float
    quantity_variance: float
    quantity_variance_pct: float
    cost_variance: float
    cost_variance_pct: float
    significance: VarianceSignificance


@dataclass
class ComparisonResult:
    """Complete comparison result."""
    comparison_type: ComparisonType
    base_name: str
    compare_name: str
    base_total: float
    compare_total: float
    total_variance: float
    total_variance_pct: float
    items: List[ComparisonItem]
    summary_by_category: Dict[str, Dict[str, float]]
    created_at: datetime


class CWICRComparisonTool:
    """Compare CWICR-based estimates."""

    SIGNIFICANCE_THRESHOLDS = {
        VarianceSignificance.CRITICAL: 0.20,
        VarianceSignificance.HIGH: 0.10,
        VarianceSignificance.MEDIUM: 0.05,
        VarianceSignificance.LOW: 0.01
    }

    def __init__(self):
        pass

    def _get_significance(self, variance_pct: float) -> VarianceSignificance:
        """Determine variance significance."""
        abs_var = abs(variance_pct) / 100

        if abs_var >= self.SIGNIFICANCE_THRESHOLDS[VarianceSignificance.CRITICAL]:
            return VarianceSignificance.CRITICAL
        elif abs_var >= self.SIGNIFICANCE_THRESHOLDS[VarianceSignificance.HIGH]:
            return VarianceSignificance.HIGH
        elif abs_var >= self.SIGNIFICANCE_THRESHOLDS[VarianceSignificance.MEDIUM]:
            return VarianceSignificance.MEDIUM
        elif abs_var >= self.SIGNIFICANCE_THRESHOLDS[VarianceSignificance.LOW]:
            return VarianceSignificance.LOW
        else:
            return VarianceSignificance.NONE

    def compare_estimates(self,
                          base_df: pd.DataFrame,
                          compare_df: pd.DataFrame,
                          base_name: str = "Base",
                          compare_name: str = "Compare",
                          comparison_type: ComparisonType = ComparisonType.VERSION,
                          code_column: str = 'work_item_code',
                          quantity_column: str = 'quantity',
                          cost_column: str = 'total_cost') -> ComparisonResult:
        """Compare two estimates."""

        # Merge on code
        merged = base_df.merge(
            compare_df,
            on=code_column,
            how='outer',
            suffixes=('_base', '_compare')
        )

        items = []
        for _, row in merged.iterrows():
            base_qty = float(row.get(f'{quantity_column}_base', 0) or 0)
            base_cost = float(row.get(f'{cost_column}_base', 0) or 0)
            compare_qty = float(row.get(f'{quantity_column}_compare', 0) or 0)
            compare_cost = float(row.get(f'{cost_column}_compare', 0) or 0)

            qty_variance = compare_qty - base_qty
            qty_variance_pct = (qty_variance / base_qty * 100) if base_qty > 0 else (100 if compare_qty > 0 else 0)

            cost_variance = compare_cost - base_cost
            cost_variance_pct = (cost_variance / base_cost * 100) if base_cost > 0 else (100 if compare_cost > 0 else 0)

            items.append(ComparisonItem(
                work_item_code=str(row.get(code_column, '')),
                description=str(row.get('description_base', row.get('description_compare', ''))),
                base_quantity=base_qty,
                base_cost=base_cost,
                compare_quantity=compare_qty,
                compare_cost=compare_cost,
                quantity_variance=round(qty_variance, 2),
                quantity_variance_pct=round(qty_variance_pct, 1),
                cost_variance=round(cost_variance, 2),
                cost_variance_pct=round(cost_variance_pct, 1),
                significance=self._get_significance(cost_variance_pct)
            ))

        # Totals
        base_total = sum(i.base_cost for i in items)
        compare_total = sum(i.compare_cost for i in items)
        total_variance = compare_total - base_total
        total_variance_pct = (total_variance / base_total * 100) if base_total > 0 else 0

        # Summary by category
        summary_by_category = self._summarize_by_category(items, merged)

        return ComparisonResult(
            comparison_type=comparison_type,
            base_name=base_name,
            compare_name=compare_name,
            base_total=round(base_total, 2),
            compare_total=round(compare_total, 2),
            total_variance=round(total_variance, 2),
            total_variance_pct=round(total_variance_pct, 1),
            items=items,
            summary_by_category=summary_by_category,
            created_at=datetime.now()
        )

    def _summarize_by_category(self,
                                items: List[ComparisonItem],
                                merged_df: pd.DataFrame) -> Dict[str, Dict[str, float]]:
        """Summarize comparison by category."""

        summary = {}

        # Try to extract category from work item code prefix
        for item in items:
            code = item.work_item_code
            category = code.split('-')[0] if '-' in code else 'Other'

            if category not in summary:
                summary[category] = {
                    'base_cost': 0,
                    'compare_cost': 0,
                    'variance': 0,
                    'variance_pct': 0,
                    'item_count': 0
                }

            summary[category]['base_cost'] += item.base_cost
            summary[category]['compare_cost'] += item.compare_cost
            summary[category]['variance'] += item.cost_variance
            summary[category]['item_count'] += 1

        # Calculate percentages
        for category in summary:
            base = summary[category]['base_cost']
            if base > 0:
                summary[category]['variance_pct'] = round(
                    summary[category]['variance'] / base * 100, 1
                )

        return summary

    def get_significant_variances(self,
                                   result: ComparisonResult,
                                   min_significance: VarianceSignificance = VarianceSignificance.MEDIUM) -> List[ComparisonItem]:
        """Get items with significant variances."""

        significance_order = [
            VarianceSignificance.CRITICAL,
            VarianceSignificance.HIGH,
            VarianceSignificance.MEDIUM,
            VarianceSignificance.LOW,
            VarianceSignificance.NONE
        ]

        min_index = significance_order.index(min_significance)
        significant = [
            item for item in result.items
            if significance_order.index(item.significance) <= min_index
        ]

        return sorted(significant, key=lambda x: abs(x.cost_variance), reverse=True)

    def compare_multiple(self,
                          estimates: List[Tuple[str, pd.DataFrame]],
                          base_index: int = 0) -> Dict[str, ComparisonResult]:
        """Compare multiple estimates against base."""

        base_name, base_df = estimates[base_index]
        results = {}

        for i, (name, df) in enumerate(estimates):
            if i == base_index:
                continue

            result = self.compare_estimates(
                base_df=base_df,
                compare_df=df,
                base_name=base_name,
                compare_name=name,
                comparison_type=ComparisonType.ALTERNATIVE
            )
            results[name] = result

        return results

    def benchmark_comparison(self,
                              project_df: pd.DataFrame,
                              benchmark_df: pd.DataFrame,
                              project_name: str,
                              benchmark_name: str = "Industry Benchmark") -> ComparisonResult:
        """Compare project against benchmark."""

        return self.compare_estimates(
            base_df=benchmark_df,
            compare_df=project_df,
            base_name=benchmark_name,
            compare_name=project_name,
            comparison_type=ComparisonType.BENCHMARK
        )

    def version_comparison(self,
                           versions: List[Tuple[str, pd.DataFrame]]) -> List[ComparisonResult]:
        """Compare sequential versions."""

        results = []

        for i in range(1, len(versions)):
            prev_name, prev_df = versions[i-1]
            curr_name, curr_df = versions[i]

            result = self.compare_estimates(
                base_df=prev_df,
                compare_df=curr_df,
                base_name=prev_name,
                compare_name=curr_name,
                comparison_type=ComparisonType.VERSION
            )
            results.append(result)

        return results

    def export_comparison(self,
                          result: ComparisonResult,
                          output_path: str) -> str:
        """Export comparison to Excel."""

        with pd.ExcelWriter(output_path, engine='openpyxl') as writer:
            # Summary
            summary_df = pd.DataFrame([{
                'Comparison Type': result.comparison_type.value,
                'Base': result.base_name,
                'Compare': result.compare_name,
                'Base Total': result.base_total,
                'Compare Total': result.compare_total,
                'Variance': result.total_variance,
                'Variance %': result.total_variance_pct,
                'Generated': result.created_at.strftime('%Y-%m-%d %H:%M')
            }])
            summary_df.to_excel(writer, sheet_name='Summary', index=False)

            # Details
            details_df = pd.DataFrame([
                {
                    'Work Item': i.work_item_code,
                    'Description': i.description,
                    f'{result.base_name} Qty': i.base_quantity,
                    f'{result.base_name} Cost': i.base_cost,
                    f'{result.compare_name} Qty': i.compare_quantity,
                    f'{result.compare_name} Cost': i.compare_cost,
                    'Qty Variance': i.quantity_variance,
                    'Qty Variance %': i.quantity_variance_pct,
                    'Cost Variance': i.cost_variance,
                    'Cost Variance %': i.cost_variance_pct,
                    'Significance': i.significance.value
                }
                for i in result.items
            ])
            details_df.to_excel(writer, sheet_name='Details', index=False)

            # By Category
            cat_df = pd.DataFrame([
                {
                    'Category': cat,
                    'Base Cost': data['base_cost'],
                    'Compare Cost': data['compare_cost'],
                    'Variance': data['variance'],
                    'Variance %': data['variance_pct'],
                    'Items': data['item_count']
                }
                for cat, data in result.summary_by_category.items()
            ])
            cat_df.to_excel(writer, sheet_name='By Category', index=False)

            # Significant Variances
            significant = self.get_significant_variances(result)
            sig_df = pd.DataFrame([
                {
                    'Work Item': i.work_item_code,
                    'Description': i.description,
                    'Cost Variance': i.cost_variance,
                    'Variance %': i.cost_variance_pct,
                    'Significance': i.significance.value
                }
                for i in significant
            ])
            sig_df.to_excel(writer, sheet_name='Significant', index=False)

        return output_path


class ComparisonAnalytics:
    """Analytics for comparison results."""

    def __init__(self, comparison_tool: CWICRComparisonTool):
        self.tool = comparison_tool

    def variance_distribution(self, result: ComparisonResult) -> Dict[str, int]:
        """Get distribution of variance significance."""

        distribution = {s.value: 0 for s in VarianceSignificance}

        for item in result.items:
            distribution[item.significance.value] += 1

        return distribution

    def top_variances(self,
                      result: ComparisonResult,
                      n: int = 10,
                      positive: bool = True) -> List[ComparisonItem]:
        """Get top N variances (positive or negative)."""

        if positive:
            sorted_items = sorted(result.items, key=lambda x: x.cost_variance, reverse=True)
        else:
            sorted_items = sorted(result.items, key=lambda x: x.cost_variance)

        return sorted_items[:n]

    def category_impact(self, result: ComparisonResult) -> pd.DataFrame:
        """Analyze which categories contribute most to variance."""

        data = []
        for cat, values in result.summary_by_category.items():
            contribution_pct = (values['variance'] / result.total_variance * 100) if result.total_variance != 0 else 0
            data.append({
                'Category': cat,
                'Variance': values['variance'],
                'Contribution %': round(contribution_pct, 1)
            })

        return pd.DataFrame(data).sort_values('Contribution %', ascending=False)

    def trend_analysis(self,
                        version_results: List[ComparisonResult]) -> pd.DataFrame:
        """Analyze cost trend across versions."""

        data = []
        cumulative = 0

        for result in version_results:
            cumulative += result.total_variance
            data.append({
                'From': result.base_name,
                'To': result.compare_name,
                'Variance': result.total_variance,
                'Variance %': result.total_variance_pct,
                'Cumulative Variance': cumulative
            })

        return pd.DataFrame(data)
```

## Quick Start

```python
# Initialize comparison tool
tool = CWICRComparisonTool()

# Compare two estimate versions
result = tool.compare_estimates(
    base_df=estimate_v1,
    compare_df=estimate_v2,
    base_name="Estimate v1.0",
    compare_name="Estimate v2.0"
)

print(f"Total Variance: ${result.total_variance:,.2f} ({result.total_variance_pct}%)")
```

## Common Use Cases

### 1. Significant Variances
```python
significant = tool.get_significant_variances(result)
for item in significant[:5]:
    print(f"{item.work_item_code}: ${item.cost_variance:,.2f} ({item.significance.value})")
```

### 2. Version History
```python
versions = [
    ("v1.0", estimate_v1),
    ("v2.0", estimate_v2),
    ("v3.0", estimate_v3)
]
version_results = tool.version_comparison(versions)

analytics = ComparisonAnalytics(tool)
trend = analytics.trend_analysis(version_results)
```

### 3. Design Alternatives
```python
alternatives = [
    ("Option A - Steel", option_a),
    ("Option B - Concrete", option_b),
    ("Option C - Hybrid", option_c)
]
comparisons = tool.compare_multiple(alternatives, base_index=0)
```

### 4. Export Report
```python
tool.export_comparison(result, "estimate_comparison.xlsx")
```

## Resources
- **GitHub**: [OpenConstructionEstimate-Jens-CWICR](https://github.com/jens-construction/OpenConstructionEstimate-Jens-CWICR)
- **Jens Book**: Chapter 3.1 - Estimate Management


---


# CWICR Cost Calculator

## Business Case

### Problem Statement
Traditional cost estimation often produces "black box" estimates with hidden markups. Stakeholders need:
- Transparent cost breakdowns
- Traceable pricing logic
- Auditable calculations
- Resource-level detail

### Solution
Resource-based cost calculation using CWICR methodology that separates physical norms (labor hours, material quantities) from volatile prices, enabling transparent and auditable estimates.

### Business Value
- **Full transparency** - Every cost component visible
- **Auditable** - Traceable calculation logic
- **Flexible** - Update prices without changing norms
- **Accurate** - Based on 55,000+ validated work items

## Technical Implementation

### Prerequisites
```bash
pip install pandas numpy
```

### Python Implementation

```python
import pandas as pd
import numpy as np
from typing import Dict, Any, List, Optional, Tuple
from dataclasses import dataclass, field
from enum import Enum
from datetime import datetime


class CostComponent(Enum):
    """Cost breakdown components."""
    LABOR = "labor"
    MATERIAL = "material"
    EQUIPMENT = "equipment"
    OVERHEAD = "overhead"
    PROFIT = "profit"
    TOTAL = "total"


class CostStatus(Enum):
    """Cost calculation status."""
    CALCULATED = "calculated"
    ESTIMATED = "estimated"
    MISSING_DATA = "missing_data"
    ERROR = "error"


@dataclass
class CostBreakdown:
    """Detailed cost breakdown for a work item."""
    work_item_code: str
    description: str
    unit: str
    quantity: float

    labor_cost: float = 0.0
    material_cost: float = 0.0
    equipment_cost: float = 0.0
    overhead_cost: float = 0.0
    profit_cost: float = 0.0

    unit_price: float = 0.0
    total_cost: float = 0.0

    labor_hours: float = 0.0
    labor_rate: float = 0.0

    resources: List[Dict[str, Any]] = field(default_factory=list)
    status: CostStatus = CostStatus.CALCULATED

    def to_dict(self) -> Dict[str, Any]:
        return {
            'work_item_code': self.work_item_code,
            'description': self.description,
            'unit': self.unit,
            'quantity': self.quantity,
            'labor_cost': self.labor_cost,
            'material_cost': self.material_cost,
            'equipment_cost': self.equipment_cost,
            'overhead_cost': self.overhead_cost,
            'profit_cost': self.profit_cost,
            'total_cost': self.total_cost,
            'status': self.status.value
        }


@dataclass
class CostSummary:
    """Summary of cost estimate."""
    total_cost: float
    labor_total: float
    material_total: float
    equipment_total: float
    overhead_total: float
    profit_total: float

    item_count: int
    currency: str
    calculated_at: datetime

    breakdown_by_category: Dict[str, float] = field(default_factory=dict)


class CWICRCostCalculator:
    """Resource-based cost calculator using CWICR methodology."""

    DEFAULT_OVERHEAD_RATE = 0.15  # 15% overhead
    DEFAULT_PROFIT_RATE = 0.10   # 10% profit

    def __init__(self, cwicr_data: pd.DataFrame,
                 overhead_rate: float = None,
                 profit_rate: float = None,
                 currency: str = "USD"):
        """Initialize calculator with CWICR data."""
        self.data = cwicr_data
        self.overhead_rate = overhead_rate or self.DEFAULT_OVERHEAD_RATE
        self.profit_rate = profit_rate or self.DEFAULT_PROFIT_RATE
        self.currency = currency

        # Index data for fast lookup
        self._index_data()

    def _index_data(self):
        """Create index for fast work item lookup."""
        if 'work_item_code' in self.data.columns:
            self._code_index = self.data.set_index('work_item_code')
        else:
            self._code_index = None

    def calculate_item_cost(self, work_item_code: str,
                            quantity: float,
                            price_overrides: Dict[str, float] = None) -> CostBreakdown:
        """Calculate cost for single work item."""

        # Find work item in database
        if self._code_index is not None and work_item_code in self._code_index.index:
            item = self._code_index.loc[work_item_code]
        else:
            # Try partial match
            matches = self.data[
                self.data['work_item_code'].str.contains(work_item_code, case=False, na=False)
            ]
            if matches.empty:
                return CostBreakdown(
                    work_item_code=work_item_code,
                    description="NOT FOUND",
                    unit="",
                    quantity=quantity,
                    status=CostStatus.MISSING_DATA
                )
            item = matches.iloc[0]

        # Get base costs
        labor_unit = float(item.get('labor_cost', 0) or 0)
        material_unit = float(item.get('material_cost', 0) or 0)
        equipment_unit = float(item.get('equipment_cost', 0) or 0)

        # Apply price overrides if provided
        if price_overrides:
            if 'labor_rate' in price_overrides:
                labor_norm = float(item.get('labor_norm', 0) or 0)
                labor_unit = labor_norm * price_overrides['labor_rate']
            if 'material_factor' in price_overrides:
                material_unit *= price_overrides['material_factor']
            if 'equipment_factor' in price_overrides:
                equipment_unit *= price_overrides['equipment_factor']

        # Calculate component costs
        labor_cost = labor_unit * quantity
        material_cost = material_unit * quantity
        equipment_cost = equipment_unit * quantity

        # Direct costs
        direct_cost = labor_cost + material_cost + equipment_cost

        # Overhead and profit
        overhead_cost = direct_cost * self.overhead_rate
        profit_cost = (direct_cost + overhead_cost) * self.profit_rate

        # Total
        total_cost = direct_cost + overhead_cost + profit_cost

        # Unit price
        unit_price = total_cost / quantity if quantity > 0 else 0

        return CostBreakdown(
            work_item_code=work_item_code,
            description=str(item.get('description', '')),
            unit=str(item.get('unit', '')),
            quantity=quantity,
            labor_cost=labor_cost,
            material_cost=material_cost,
            equipment_cost=equipment_cost,
            overhead_cost=overhead_cost,
            profit_cost=profit_cost,
            unit_price=unit_price,
            total_cost=total_cost,
            labor_hours=float(item.get('labor_norm', 0) or 0) * quantity,
            labor_rate=float(item.get('labor_rate', 0) or 0),
            status=CostStatus.CALCULATED
        )

    def calculate_estimate(self, items: List[Dict[str, Any]],
                          group_by_category: bool = True) -> CostSummary:
        """Calculate cost estimate for multiple items."""

        breakdowns = []
        for item in items:
            code = item.get('work_item_code') or item.get('code')
            qty = item.get('quantity', 0)
            overrides = item.get('price_overrides')

            breakdown = self.calculate_item_cost(code, qty, overrides)
            breakdowns.append(breakdown)

        # Aggregate totals
        labor_total = sum(b.labor_cost for b in breakdowns)
        material_total = sum(b.material_cost for b in breakdowns)
        equipment_total = sum(b.equipment_cost for b in breakdowns)
        overhead_total = sum(b.overhead_cost for b in breakdowns)
        profit_total = sum(b.profit_cost for b in breakdowns)
        total_cost = sum(b.total_cost for b in breakdowns)

        # Group by category if requested
        breakdown_by_category = {}
        if group_by_category:
            for b in breakdowns:
                # Extract category from work item code prefix
                category = b.work_item_code.split('-')[0] if '-' in b.work_item_code else 'Other'
                if category not in breakdown_by_category:
                    breakdown_by_category[category] = 0
                breakdown_by_category[category] += b.total_cost

        return CostSummary(
            total_cost=total_cost,
            labor_total=labor_total,
            material_total=material_total,
            equipment_total=equipment_total,
            overhead_total=overhead_total,
            profit_total=profit_total,
            item_count=len(breakdowns),
            currency=self.currency,
            calculated_at=datetime.now(),
            breakdown_by_category=breakdown_by_category
        )

    def calculate_from_qto(self, qto_df: pd.DataFrame,
                          code_column: str = 'work_item_code',
                          quantity_column: str = 'quantity') -> pd.DataFrame:
        """Calculate costs from Quantity Takeoff DataFrame."""

        results = []
        for _, row in qto_df.iterrows():
            code = row[code_column]
            qty = row[quantity_column]

            breakdown = self.calculate_item_cost(code, qty)
            result = breakdown.to_dict()

            # Add original QTO columns
            for col in qto_df.columns:
                if col not in result:
                    result[f'qto_{col}'] = row[col]

            results.append(result)

        return pd.DataFrame(results)

    def apply_regional_factors(self, base_costs: pd.DataFrame,
                               region_factors: Dict[str, float]) -> pd.DataFrame:
        """Apply regional adjustment factors."""
        adjusted = base_costs.copy()

        if 'labor_cost' in adjusted.columns and 'labor' in region_factors:
            adjusted['labor_cost'] *= region_factors['labor']

        if 'material_cost' in adjusted.columns and 'material' in region_factors:
            adjusted['material_cost'] *= region_factors['material']

        if 'equipment_cost' in adjusted.columns and 'equipment' in region_factors:
            adjusted['equipment_cost'] *= region_factors['equipment']

        # Recalculate totals
        adjusted['direct_cost'] = (
            adjusted.get('labor_cost', 0) +
            adjusted.get('material_cost', 0) +
            adjusted.get('equipment_cost', 0)
        )
        adjusted['total_cost'] = adjusted['direct_cost'] * (1 + self.overhead_rate) * (1 + self.profit_rate)

        return adjusted

    def compare_estimates(self, estimate1: CostSummary,
                         estimate2: CostSummary) -> Dict[str, Any]:
        """Compare two cost estimates."""
        return {
            'total_difference': estimate2.total_cost - estimate1.total_cost,
            'total_percent_change': (
                (estimate2.total_cost - estimate1.total_cost) /
                estimate1.total_cost * 100 if estimate1.total_cost > 0 else 0
            ),
            'labor_difference': estimate2.labor_total - estimate1.labor_total,
            'material_difference': estimate2.material_total - estimate1.material_total,
            'equipment_difference': estimate2.equipment_total - estimate1.equipment_total,
            'item_count_difference': estimate2.item_count - estimate1.item_count
        }


class CostReportGenerator:
    """Generate cost reports from calculations."""

    def __init__(self, calculator: CWICRCostCalculator):
        self.calculator = calculator

    def generate_summary_report(self, items: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Generate summary cost report."""
        summary = self.calculator.calculate_estimate(items)

        return {
            'report_date': datetime.now().isoformat(),
            'currency': summary.currency,
            'total_cost': round(summary.total_cost, 2),
            'breakdown': {
                'labor': round(summary.labor_total, 2),
                'material': round(summary.material_total, 2),
                'equipment': round(summary.equipment_total, 2),
                'overhead': round(summary.overhead_total, 2),
                'profit': round(summary.profit_total, 2)
            },
            'percentages': {
                'labor': round(summary.labor_total / summary.total_cost * 100, 1) if summary.total_cost > 0 else 0,
                'material': round(summary.material_total / summary.total_cost * 100, 1) if summary.total_cost > 0 else 0,
                'equipment': round(summary.equipment_total / summary.total_cost * 100, 1) if summary.total_cost > 0 else 0,
            },
            'item_count': summary.item_count,
            'by_category': summary.breakdown_by_category
        }

    def generate_detailed_report(self, items: List[Dict[str, Any]]) -> pd.DataFrame:
        """Generate detailed line-item report."""
        results = []

        for item in items:
            code = item.get('work_item_code') or item.get('code')
            qty = item.get('quantity', 0)

            breakdown = self.calculator.calculate_item_cost(code, qty)
            results.append(breakdown.to_dict())

        df = pd.DataFrame(results)

        # Add totals row
        totals = df[['labor_cost', 'material_cost', 'equipment_cost',
                     'overhead_cost', 'profit_cost', 'total_cost']].sum()
        totals['description'] = 'TOTAL'
        totals['work_item_code'] = ''

        df = pd.concat([df, pd.DataFrame([totals])], ignore_index=True)

        return df


# Convenience functions
def calculate_cost(cwicr_data: pd.DataFrame,
                   work_item_code: str,
                   quantity: float) -> float:
    """Quick cost calculation."""
    calc = CWICRCostCalculator(cwicr_data)
    breakdown = calc.calculate_item_cost(work_item_code, quantity)
    return breakdown.total_cost


def estimate_project_cost(cwicr_data: pd.DataFrame,
                         items: List[Dict[str, Any]]) -> Dict[str, Any]:
    """Quick project cost estimate."""
    calc = CWICRCostCalculator(cwicr_data)
    report = CostReportGenerator(calc)
    return report.generate_summary_report(items)
```

## Quick Start

```python
import pandas as pd
from cwicr_data_loader import CWICRDataLoader

# Load CWICR data
loader = CWICRDataLoader()
cwicr = loader.load("ddc_cwicr_en.parquet")

# Initialize calculator
calc = CWICRCostCalculator(cwicr)

# Calculate single item
breakdown = calc.calculate_item_cost("CONC-001", quantity=150)
print(f"Total: ${breakdown.total_cost:,.2f}")
print(f"  Labor: ${breakdown.labor_cost:,.2f}")
print(f"  Material: ${breakdown.material_cost:,.2f}")
print(f"  Equipment: ${breakdown.equipment_cost:,.2f}")
```

## Common Use Cases

### 1. Project Estimate
```python
items = [
    {'work_item_code': 'CONC-001', 'quantity': 150},
    {'work_item_code': 'EXCV-002', 'quantity': 200},
    {'work_item_code': 'REBAR-003', 'quantity': 15000}  # kg
]

summary = calc.calculate_estimate(items)
print(f"Project Total: ${summary.total_cost:,.2f}")
```

### 2. QTO Integration
```python
# Load BIM quantities
qto = pd.read_excel("quantities.xlsx")

# Calculate costs
costs = calc.calculate_from_qto(qto,
    code_column='work_item',
    quantity_column='quantity'
)
print(costs[['description', 'quantity', 'total_cost']])
```

### 3. Regional Adjustment
```python
# Apply Berlin pricing
berlin_factors = {
    'labor': 1.15,      # 15% higher labor
    'material': 0.95,   # 5% lower materials
    'equipment': 1.0
}

adjusted = calc.apply_regional_factors(costs, berlin_factors)
```

## Resources

- **GitHub**: [OpenConstructionEstimate-Jens-CWICR](https://github.com/jens-construction/OpenConstructionEstimate-Jens-CWICR)
- **Jens Book**: Chapter 3.1 - Construction Cost Estimation


---


# CWICR Crew Optimizer

## Business Case

### Problem Statement
Crew planning challenges:
- Right mix of workers?
- Optimal crew size?
- Balance cost vs productivity?
- Match skills to work?

### Solution
Optimize crew composition using CWICR labor productivity data to balance cost, output, and skill requirements.

### Business Value
- **Optimal productivity** - Right-sized crews
- **Cost efficiency** - No overstaffing
- **Skill matching** - Proper worker mix
- **Schedule support** - Meet deadlines

## Technical Implementation

```python
import pandas as pd
import numpy as np
from typing import Dict, Any, List, Optional, Tuple
from dataclasses import dataclass, field
from enum import Enum
from datetime import date, timedelta


class WorkerType(Enum):
    """Types of workers."""
    FOREMAN = "foreman"
    JOURNEYMAN = "journeyman"
    APPRENTICE = "apprentice"
    LABORER = "laborer"
    OPERATOR = "operator"
    HELPER = "helper"


class Trade(Enum):
    """Construction trades."""
    CONCRETE = "concrete"
    CARPENTRY = "carpentry"
    MASONRY = "masonry"
    STEEL = "steel"
    ELECTRICAL = "electrical"
    PLUMBING = "plumbing"
    HVAC = "hvac"
    PAINTING = "painting"
    ROOFING = "roofing"
    GENERAL = "general"


@dataclass
class Worker:
    """Worker definition."""
    worker_type: WorkerType
    trade: Trade
    hourly_rate: float
    productivity_factor: float = 1.0
    overtime_multiplier: float = 1.5


@dataclass
class CrewComposition:
    """Crew composition."""
    name: str
    trade: Trade
    workers: List[Tuple[WorkerType, int]]  # (type, count)
    base_productivity: float  # Output per hour
    hourly_cost: float
    daily_output: float


@dataclass
class CrewOptimizationResult:
    """Result of crew optimization."""
    work_item: str
    quantity: float
    unit: str
    recommended_crew: CrewComposition
    alternative_crews: List[CrewComposition]
    duration_days: float
    total_labor_cost: float
    cost_per_unit: float


# Standard crew compositions
STANDARD_CREWS = {
    'concrete_small': {
        'trade': Trade.CONCRETE,
        'workers': [(WorkerType.FOREMAN, 1), (WorkerType.JOURNEYMAN, 2), (WorkerType.LABORER, 2)],
        'productivity': 1.0
    },
    'concrete_large': {
        'trade': Trade.CONCRETE,
        'workers': [(WorkerType.FOREMAN, 1), (WorkerType.JOURNEYMAN, 4), (WorkerType.LABORER, 4), (WorkerType.OPERATOR, 1)],
        'productivity': 1.8
    },
    'masonry_standard': {
        'trade': Trade.MASONRY,
        'workers': [(WorkerType.FOREMAN, 1), (WorkerType.JOURNEYMAN, 2), (WorkerType.HELPER, 2)],
        'productivity': 1.0
    },
    'carpentry_framing': {
        'trade': Trade.CARPENTRY,
        'workers': [(WorkerType.FOREMAN, 1), (WorkerType.JOURNEYMAN, 3), (WorkerType.APPRENTICE, 1)],
        'productivity': 1.0
    },
    'electrical_rough': {
        'trade': Trade.ELECTRICAL,
        'workers': [(WorkerType.FOREMAN, 1), (WorkerType.JOURNEYMAN, 2), (WorkerType.APPRENTICE, 1)],
        'productivity': 1.0
    },
    'plumbing_rough': {
        'trade': Trade.PLUMBING,
        'workers': [(WorkerType.FOREMAN, 1), (WorkerType.JOURNEYMAN, 2), (WorkerType.APPRENTICE, 1)],
        'productivity': 1.0
    }
}

# Default hourly rates by worker type
DEFAULT_RATES = {
    WorkerType.FOREMAN: 65,
    WorkerType.JOURNEYMAN: 55,
    WorkerType.APPRENTICE: 35,
    WorkerType.LABORER: 30,
    WorkerType.OPERATOR: 60,
    WorkerType.HELPER: 28
}


class CWICRCrewOptimizer:
    """Optimize crew composition using CWICR data."""

    HOURS_PER_DAY = 8

    def __init__(self,
                 cwicr_data: pd.DataFrame = None,
                 custom_rates: Dict[WorkerType, float] = None):
        self.cost_data = cwicr_data
        self.rates = custom_rates or DEFAULT_RATES
        if cwicr_data is not None:
            self._index_data()

    def _index_data(self):
        """Index cost data."""
        if 'work_item_code' in self.cost_data.columns:
            self._code_index = self.cost_data.set_index('work_item_code')
        else:
            self._code_index = None

    def get_labor_norm(self, code: str) -> Tuple[float, str]:
        """Get labor hours per unit from CWICR."""
        if self._code_index is None or code not in self._code_index.index:
            return (1.0, 'unit')

        item = self._code_index.loc[code]
        norm = float(item.get('labor_norm', item.get('labor_hours', 1)) or 1)
        unit = str(item.get('unit', 'unit'))

        return (norm, unit)

    def calculate_crew_cost(self, workers: List[Tuple[WorkerType, int]]) -> float:
        """Calculate hourly cost of crew."""
        total = 0
        for worker_type, count in workers:
            rate = self.rates.get(worker_type, 40)
            total += rate * count
        return total

    def build_crew(self,
                   name: str,
                   trade: Trade,
                   workers: List[Tuple[WorkerType, int]],
                   base_productivity: float = 1.0) -> CrewComposition:
        """Build crew composition."""

        hourly_cost = self.calculate_crew_cost(workers)
        daily_output = base_productivity * self.HOURS_PER_DAY

        return CrewComposition(
            name=name,
            trade=trade,
            workers=workers,
            base_productivity=base_productivity,
            hourly_cost=hourly_cost,
            daily_output=daily_output
        )

    def optimize_for_work(self,
                           work_item_code: str,
                           quantity: float,
                           target_days: int = None,
                           max_crew_size: int = 10) -> CrewOptimizationResult:
        """Optimize crew for specific work item."""

        labor_norm, unit = self.get_labor_norm(work_item_code)
        total_hours = quantity * labor_norm

        # Detect trade from code
        trade = self._detect_trade(work_item_code)

        # Generate crew options
        crews = []

        # Small crew
        small_workers = [(WorkerType.FOREMAN, 1), (WorkerType.JOURNEYMAN, 2), (WorkerType.LABORER, 1)]
        small_crew = self.build_crew("Small Crew", trade, small_workers, 1.0)
        crews.append(small_crew)

        # Medium crew
        med_workers = [(WorkerType.FOREMAN, 1), (WorkerType.JOURNEYMAN, 3), (WorkerType.LABORER, 2)]
        med_crew = self.build_crew("Medium Crew", trade, med_workers, 1.4)
        crews.append(med_crew)

        # Large crew
        large_workers = [(WorkerType.FOREMAN, 1), (WorkerType.JOURNEYMAN, 5), (WorkerType.LABORER, 3)]
        large_crew = self.build_crew("Large Crew", trade, large_workers, 2.0)
        crews.append(large_crew)

        # Calculate metrics for each crew
        results = []
        for crew in crews:
            # Adjusted productivity considering crew efficiency
            crew_workers = sum(count for _, count in crew.workers)
            efficiency = self._crew_efficiency(crew_workers)

            effective_productivity = crew.base_productivity * efficiency
            hours_needed = total_hours / effective_productivity
            days_needed = hours_needed / self.HOURS_PER_DAY
            labor_cost = hours_needed * crew.hourly_cost
            cost_per_unit = labor_cost / quantity if quantity > 0 else 0

            results.append({
                'crew': crew,
                'days': days_needed,
                'cost': labor_cost,
                'cost_per_unit': cost_per_unit,
                'efficiency': efficiency
            })

        # Select best crew based on target
        if target_days:
            # Find crew that meets target with lowest cost
            valid = [r for r in results if r['days'] <= target_days]
            if valid:
                best = min(valid, key=lambda x: x['cost'])
            else:
                best = min(results, key=lambda x: x['days'])
        else:
            # Optimize for cost
            best = min(results, key=lambda x: x['cost'])

        recommended = best['crew']
        alternatives = [r['crew'] for r in results if r['crew'] != recommended]

        return CrewOptimizationResult(
            work_item=work_item_code,
            quantity=quantity,
            unit=unit,
            recommended_crew=recommended,
            alternative_crews=alternatives,
            duration_days=round(best['days'], 1),
            total_labor_cost=round(best['cost'], 2),
            cost_per_unit=round(best['cost_per_unit'], 2)
        )

    def _detect_trade(self, code: str) -> Trade:
        """Detect trade from work item code."""
        code_lower = code.lower()

        trade_map = {
            'conc': Trade.CONCRETE,
            'carp': Trade.CARPENTRY,
            'mason': Trade.MASONRY,
            'steel': Trade.STEEL,
            'strl': Trade.STEEL,
            'elec': Trade.ELECTRICAL,
            'plumb': Trade.PLUMBING,
            'hvac': Trade.HVAC,
            'paint': Trade.PAINTING,
            'roof': Trade.ROOFING
        }

        for key, trade in trade_map.items():
            if key in code_lower:
                return trade

        return Trade.GENERAL

    def _crew_efficiency(self, crew_size: int) -> float:
        """Calculate crew efficiency based on size (law of diminishing returns)."""
        if crew_size <= 4:
            return 1.0
        elif crew_size <= 6:
            return 0.95
        elif crew_size <= 8:
            return 0.90
        elif crew_size <= 10:
            return 0.85
        else:
            return 0.80

    def analyze_overtime(self,
                          result: CrewOptimizationResult,
                          available_days: int,
                          max_overtime_hours: float = 2) -> Dict[str, Any]:
        """Analyze if overtime can meet schedule."""

        if result.duration_days <= available_days:
            return {
                'overtime_needed': False,
                'regular_days': result.duration_days,
                'overtime_hours': 0,
                'overtime_cost': 0,
                'total_cost': result.total_labor_cost
            }

        # Calculate overtime needed
        regular_hours = available_days * self.HOURS_PER_DAY
        total_hours_available = available_days * (self.HOURS_PER_DAY + max_overtime_hours)

        labor_norm, _ = self.get_labor_norm(result.work_item)
        total_hours_needed = result.quantity * labor_norm / result.recommended_crew.base_productivity

        if total_hours_needed > total_hours_available:
            # Can't meet schedule even with overtime
            overtime_hours = available_days * max_overtime_hours
            shortage = total_hours_needed - total_hours_available
        else:
            overtime_hours = total_hours_needed - regular_hours
            shortage = 0

        overtime_cost = overtime_hours * result.recommended_crew.hourly_cost * 1.5

        return {
            'overtime_needed': True,
            'regular_days': available_days,
            'overtime_hours_per_day': max_overtime_hours,
            'total_overtime_hours': round(overtime_hours, 1),
            'overtime_cost': round(overtime_cost, 2),
            'total_cost': round(result.total_labor_cost + overtime_cost, 2),
            'shortage_hours': round(shortage, 1) if shortage > 0 else 0,
            'can_meet_schedule': shortage == 0
        }

    def export_crew_plan(self,
                          results: List[CrewOptimizationResult],
                          output_path: str) -> str:
        """Export crew plan to Excel."""

        with pd.ExcelWriter(output_path, engine='openpyxl') as writer:
            # Summary
            summary_data = []
            for r in results:
                workers_str = ", ".join(f"{count}x {wt.value}" for wt, count in r.recommended_crew.workers)
                summary_data.append({
                    'Work Item': r.work_item,
                    'Quantity': r.quantity,
                    'Unit': r.unit,
                    'Crew': r.recommended_crew.name,
                    'Workers': workers_str,
                    'Duration Days': r.duration_days,
                    'Labor Cost': r.total_labor_cost,
                    'Cost/Unit': r.cost_per_unit
                })

            summary_df = pd.DataFrame(summary_data)
            summary_df.to_excel(writer, sheet_name='Crew Plan', index=False)

            # Totals
            totals_df = pd.DataFrame([{
                'Total Duration': max(r.duration_days for r in results),
                'Total Labor Cost': sum(r.total_labor_cost for r in results)
            }])
            totals_df.to_excel(writer, sheet_name='Totals', index=False)

        return output_path
```

## Quick Start

```python
# Load CWICR data
cwicr = pd.read_parquet("ddc_cwicr_en.parquet")

# Initialize optimizer
optimizer = CWICRCrewOptimizer(cwicr)

# Optimize crew for work item
result = optimizer.optimize_for_work(
    work_item_code="CONC-SLAB-001",
    quantity=500,  # m2
    target_days=10
)

print(f"Recommended: {result.recommended_crew.name}")
print(f"Duration: {result.duration_days} days")
print(f"Labor Cost: ${result.total_labor_cost:,.2f}")
```

## Common Use Cases

### 1. Meet Schedule with Overtime
```python
overtime = optimizer.analyze_overtime(result, available_days=8)
print(f"Overtime needed: {overtime['overtime_needed']}")
print(f"Total cost: ${overtime['total_cost']:,.2f}")
```

### 2. Compare Crews
```python
for crew in [result.recommended_crew] + result.alternative_crews:
    print(f"{crew.name}: ${crew.hourly_cost}/hr")
```

### 3. Custom Crew
```python
custom = optimizer.build_crew(
    name="Custom Concrete",
    trade=Trade.CONCRETE,
    workers=[
        (WorkerType.FOREMAN, 1),
        (WorkerType.JOURNEYMAN, 4),
        (WorkerType.LABORER, 2)
    ],
    base_productivity=1.5
)
```

## Resources
- **GitHub**: [OpenConstructionEstimate-Jens-CWICR](https://github.com/jens-construction/OpenConstructionEstimate-Jens-CWICR)
- **Jens Book**: Chapter 3.1 - Crew Productivity Analysis


---


# CWICR Data Loader

## Business Case

### Problem Statement
Jens CWICR database is distributed in multiple formats:
- Apache Parquet (optimized for analytics)
- Excel workbooks (human-readable)
- CSV files (universal exchange)
- Qdrant snapshots (vector search)

Applications need unified data access regardless of source format.

### Solution
Universal data loader supporting all CWICR formats with automatic schema detection, validation, and pandas DataFrame conversion.

### Business Value
- **Format agnostic** - Load from any CWICR distribution
- **Validated data** - Automatic schema validation
- **Memory efficient** - Lazy loading for large datasets
- **Type-safe** - Proper data types preserved

## Technical Implementation

### Prerequisites
```bash
pip install pandas pyarrow openpyxl qdrant-client
```

### Python Implementation

```python
import pandas as pd
import pyarrow.parquet as pq
from pathlib import Path
from typing import Optional, Dict, Any, List, Union
from dataclasses import dataclass, field
from enum import Enum
import json


class CWICRFormat(Enum):
    """Supported CWICR data formats."""
    PARQUET = "parquet"
    EXCEL = "excel"
    CSV = "csv"
    QDRANT = "qdrant"
    JSON = "json"


class CWICRLanguage(Enum):
    """Supported languages in CWICR database."""
    ARABIC = "ar"
    CHINESE = "zh"
    GERMAN = "de"
    ENGLISH = "en"
    SPANISH = "es"
    FRENCH = "fr"
    HINDI = "hi"
    PORTUGUESE = "pt"
    RUSSIAN = "ru"


@dataclass
class CWICRSchema:
    """CWICR database schema definition."""

    # Core fields
    work_item_code: str = "work_item_code"
    description: str = "description"
    unit: str = "unit"
    category: str = "category"

    # Cost fields
    unit_price: str = "unit_price"
    labor_cost: str = "labor_cost"
    material_cost: str = "material_cost"
    equipment_cost: str = "equipment_cost"
    overhead_cost: str = "overhead_cost"

    # Norm fields
    labor_norm: str = "labor_norm"
    material_norm: str = "material_norm"
    equipment_norm: str = "equipment_norm"

    # Metadata
    language: str = "language"
    region: str = "region"
    currency: str = "currency"
    last_updated: str = "last_updated"

    # Optional embedding
    embedding: str = "embedding"


@dataclass
class CWICRWorkItem:
    """Represents a single work item from CWICR database."""
    work_item_code: str
    description: str
    unit: str
    category: str

    unit_price: float = 0.0
    labor_cost: float = 0.0
    material_cost: float = 0.0
    equipment_cost: float = 0.0
    overhead_cost: float = 0.0

    labor_norm: float = 0.0
    labor_unit: str = "h"

    resources: List[Dict[str, Any]] = field(default_factory=list)

    language: str = "en"
    region: str = ""
    currency: str = "USD"


@dataclass
class CWICRResource:
    """Represents a resource (material, labor, equipment)."""
    resource_code: str
    description: str
    unit: str
    unit_price: float
    resource_type: str  # 'labor', 'material', 'equipment'
    category: str = ""


class CWICRDataLoader:
    """Universal loader for CWICR database formats."""

    REQUIRED_COLUMNS = ['work_item_code', 'description', 'unit']
    NUMERIC_COLUMNS = ['unit_price', 'labor_cost', 'material_cost',
                       'equipment_cost', 'labor_norm']

    def __init__(self):
        self.schema = CWICRSchema()
        self._cache: Dict[str, pd.DataFrame] = {}

    def load(self, source: str,
             format: Optional[CWICRFormat] = None,
             language: Optional[CWICRLanguage] = None,
             use_cache: bool = True) -> pd.DataFrame:
        """Load CWICR data from any supported source."""

        cache_key = f"{source}_{language}"
        if use_cache and cache_key in self._cache:
            return self._cache[cache_key]

        # Auto-detect format if not specified
        if format is None:
            format = self._detect_format(source)

        # Load based on format
        if format == CWICRFormat.PARQUET:
            df = self._load_parquet(source)
        elif format == CWICRFormat.EXCEL:
            df = self._load_excel(source)
        elif format == CWICRFormat.CSV:
            df = self._load_csv(source)
        elif format == CWICRFormat.JSON:
            df = self._load_json(source)
        else:
            raise ValueError(f"Unsupported format: {format}")

        # Validate and normalize
        df = self._validate_schema(df)
        df = self._normalize_types(df)

        # Filter by language if specified
        if language and 'language' in df.columns:
            df = df[df['language'] == language.value]

        # Cache result
        if use_cache:
            self._cache[cache_key] = df

        return df

    def _detect_format(self, source: str) -> CWICRFormat:
        """Auto-detect data format from source."""
        path = Path(source)

        if path.suffix.lower() == '.parquet':
            return CWICRFormat.PARQUET
        elif path.suffix.lower() in ['.xlsx', '.xls']:
            return CWICRFormat.EXCEL
        elif path.suffix.lower() == '.csv':
            return CWICRFormat.CSV
        elif path.suffix.lower() == '.json':
            return CWICRFormat.JSON
        else:
            raise ValueError(f"Cannot detect format: {source}")

    def _load_parquet(self, source: str) -> pd.DataFrame:
        """Load from Parquet file."""
        return pd.read_parquet(source)

    def _load_excel(self, source: str,
                    sheet_name: str = "WorkItems") -> pd.DataFrame:
        """Load from Excel workbook."""
        try:
            return pd.read_excel(source, sheet_name=sheet_name)
        except:
            # Try first sheet if named sheet doesn't exist
            return pd.read_excel(source, sheet_name=0)

    def _load_csv(self, source: str) -> pd.DataFrame:
        """Load from CSV file."""
        # Try different encodings
        for encoding in ['utf-8', 'latin-1', 'cp1252']:
            try:
                return pd.read_csv(source, encoding=encoding)
            except UnicodeDecodeError:
                continue
        raise ValueError(f"Cannot read CSV with any encoding: {source}")

    def _load_json(self, source: str) -> pd.DataFrame:
        """Load from JSON file."""
        with open(source, 'r', encoding='utf-8') as f:
            data = json.load(f)

        if isinstance(data, list):
            return pd.DataFrame(data)
        elif isinstance(data, dict) and 'items' in data:
            return pd.DataFrame(data['items'])
        else:
            return pd.DataFrame([data])

    def _validate_schema(self, df: pd.DataFrame) -> pd.DataFrame:
        """Validate DataFrame against CWICR schema."""
        # Check required columns
        missing = set(self.REQUIRED_COLUMNS) - set(df.columns)
        if missing:
            raise ValueError(f"Missing required columns: {missing}")

        return df

    def _normalize_types(self, df: pd.DataFrame) -> pd.DataFrame:
        """Normalize column types."""
        for col in self.NUMERIC_COLUMNS:
            if col in df.columns:
                df[col] = pd.to_numeric(df[col], errors='coerce').fillna(0)

        # Ensure string columns
        for col in ['work_item_code', 'description', 'unit', 'category']:
            if col in df.columns:
                df[col] = df[col].astype(str)

        return df

    def load_resources(self, source: str,
                       format: Optional[CWICRFormat] = None) -> pd.DataFrame:
        """Load resources separately."""
        if format is None:
            format = self._detect_format(source)

        if format == CWICRFormat.EXCEL:
            try:
                return pd.read_excel(source, sheet_name="Resources")
            except:
                return pd.DataFrame()
        else:
            return self.load(source, format)

    def get_work_item(self, df: pd.DataFrame,
                      code: str) -> Optional[CWICRWorkItem]:
        """Get single work item by code."""
        item = df[df['work_item_code'] == code]
        if item.empty:
            return None

        row = item.iloc[0]
        return CWICRWorkItem(
            work_item_code=row['work_item_code'],
            description=row.get('description', ''),
            unit=row.get('unit', ''),
            category=row.get('category', ''),
            unit_price=row.get('unit_price', 0),
            labor_cost=row.get('labor_cost', 0),
            material_cost=row.get('material_cost', 0),
            equipment_cost=row.get('equipment_cost', 0),
            labor_norm=row.get('labor_norm', 0),
            language=row.get('language', 'en'),
            region=row.get('region', ''),
            currency=row.get('currency', 'USD')
        )

    def get_categories(self, df: pd.DataFrame) -> List[str]:
        """Get unique categories."""
        if 'category' not in df.columns:
            return []
        return df['category'].dropna().unique().tolist()

    def filter_by_category(self, df: pd.DataFrame,
                           category: str) -> pd.DataFrame:
        """Filter work items by category."""
        return df[df['category'] == category]

    def search_by_description(self, df: pd.DataFrame,
                              keyword: str,
                              case_sensitive: bool = False) -> pd.DataFrame:
        """Simple keyword search in descriptions."""
        if case_sensitive:
            return df[df['description'].str.contains(keyword, na=False)]
        return df[df['description'].str.contains(keyword, case=False, na=False)]

    def get_statistics(self, df: pd.DataFrame) -> Dict[str, Any]:
        """Get database statistics."""
        stats = {
            'total_work_items': len(df),
            'categories': df['category'].nunique() if 'category' in df.columns else 0,
            'languages': df['language'].unique().tolist() if 'language' in df.columns else ['en']
        }

        if 'unit_price' in df.columns:
            stats['price_range'] = {
                'min': df['unit_price'].min(),
                'max': df['unit_price'].max(),
                'mean': df['unit_price'].mean()
            }

        return stats

    def export(self, df: pd.DataFrame,
               output_path: str,
               format: CWICRFormat = CWICRFormat.PARQUET):
        """Export DataFrame to file."""
        if format == CWICRFormat.PARQUET:
            df.to_parquet(output_path, index=False)
        elif format == CWICRFormat.EXCEL:
            df.to_excel(output_path, index=False)
        elif format == CWICRFormat.CSV:
            df.to_csv(output_path, index=False)
        elif format == CWICRFormat.JSON:
            df.to_json(output_path, orient='records', indent=2)


class CWICRBatchLoader:
    """Load multiple CWICR files and merge."""

    def __init__(self):
        self.loader = CWICRDataLoader()

    def load_multiple(self, sources: List[str]) -> pd.DataFrame:
        """Load and merge multiple CWICR files."""
        dfs = []
        for source in sources:
            try:
                df = self.loader.load(source)
                dfs.append(df)
            except Exception as e:
                print(f"Warning: Failed to load {source}: {e}")

        if not dfs:
            return pd.DataFrame()

        return pd.concat(dfs, ignore_index=True)

    def load_all_languages(self, base_path: str) -> pd.DataFrame:
        """Load all language variants from directory."""
        path = Path(base_path)
        dfs = []

        for lang in CWICRLanguage:
            # Try various naming patterns
            patterns = [
                f"cwicr_{lang.value}.*",
                f"ddc_cwicr_{lang.value}.*",
                f"*_{lang.value}.*"
            ]

            for pattern in patterns:
                files = list(path.glob(pattern))
                for file in files:
                    try:
                        df = self.loader.load(str(file), language=lang)
                        dfs.append(df)
                    except Exception as e:
                        continue

        if not dfs:
            return pd.DataFrame()

        return pd.concat(dfs, ignore_index=True)


# Convenience functions
def load_cwicr(source: str, language: str = None) -> pd.DataFrame:
    """Quick load CWICR data."""
    loader = CWICRDataLoader()
    lang = CWICRLanguage(language) if language else None
    return loader.load(source, language=lang)


def get_cwicr_statistics(source: str) -> Dict[str, Any]:
    """Get statistics from CWICR source."""
    loader = CWICRDataLoader()
    df = loader.load(source)
    return loader.get_statistics(df)
```

## Quick Start

```python
# Load from Parquet (fastest)
loader = CWICRDataLoader()
df = loader.load("ddc_cwicr_en.parquet")
print(f"Loaded {len(df)} work items")

# Load from Excel
df = loader.load("cwicr_database.xlsx")

# Get specific work item
item = loader.get_work_item(df, "CONC-001")
print(f"{item.description}: ${item.unit_price} per {item.unit}")

# Get all categories
categories = loader.get_categories(df)
print(f"Categories: {categories}")
```

## Common Use Cases

### 1. Multi-Language Loading
```python
batch = CWICRBatchLoader()
all_languages = batch.load_all_languages("C:/CWICR/")
print(f"Total items across all languages: {len(all_languages)}")
```

### 2. Category Filtering
```python
loader = CWICRDataLoader()
df = loader.load("cwicr.parquet")

# Get concrete work items
concrete = loader.filter_by_category(df, "Concrete")
print(f"Concrete items: {len(concrete)}")
```

### 3. Keyword Search
```python
# Find all masonry-related items
masonry = loader.search_by_description(df, "masonry")
print(masonry[['work_item_code', 'description', 'unit_price']])
```

## Database Statistics

```python
stats = loader.get_statistics(df)
print(f"Total items: {stats['total_work_items']}")
print(f"Categories: {stats['categories']}")
print(f"Price range: ${stats['price_range']['min']:.2f} - ${stats['price_range']['max']:.2f}")
```

## Resources

- **GitHub**: [OpenConstructionEstimate-Jens-CWICR](https://github.com/jens-construction/OpenConstructionEstimate-Jens-CWICR)
- **Downloads**: [CWICR Releases](https://github.com/jens-construction/OpenConstructionEstimate-Jens-CWICR/releases)
- **Formats**: Parquet, Excel, CSV, Qdrant snapshots


---


# CWICR Data Validator

## Business Case

### Problem Statement
Data quality issues cause:
- Incorrect estimates
- Budget overruns
- Delayed projects
- Rework costs

### Solution
Systematic validation of CWICR data and estimate inputs to catch errors, outliers, and inconsistencies before they impact projects.

### Business Value
- **Error prevention** - Catch issues early
- **Data quality** - Ensure reliable estimates
- **Consistency** - Standard validation rules
- **Audit trail** - Document data issues

## Technical Implementation

```python
import pandas as pd
import numpy as np
from typing import Dict, Any, List, Optional, Tuple
from dataclasses import dataclass, field
from enum import Enum
from datetime import datetime


class ValidationSeverity(Enum):
    """Validation issue severity."""
    ERROR = "error"          # Must fix
    WARNING = "warning"      # Should review
    INFO = "info"            # For awareness


class ValidationCategory(Enum):
    """Validation categories."""
    MISSING_DATA = "missing_data"
    INVALID_VALUE = "invalid_value"
    OUTLIER = "outlier"
    DUPLICATE = "duplicate"
    INCONSISTENT = "inconsistent"
    FORMAT = "format"


@dataclass
class ValidationIssue:
    """Single validation issue."""
    field: str
    record_id: str
    category: ValidationCategory
    severity: ValidationSeverity
    message: str
    current_value: Any
    expected: str


@dataclass
class ValidationResult:
    """Complete validation result."""
    total_records: int
    valid_records: int
    issues: List[ValidationIssue]
    error_count: int
    warning_count: int
    info_count: int
    validation_date: datetime
    passed: bool


class CWICRDataValidator:
    """Validate CWICR data and estimates."""

    # Standard validation rules
    REQUIRED_FIELDS = ['work_item_code', 'description', 'unit']
    NUMERIC_FIELDS = ['labor_cost', 'material_cost', 'equipment_cost', 'labor_norm']
    POSITIVE_FIELDS = ['labor_cost', 'material_cost', 'equipment_cost', 'quantity']

    # Outlier detection thresholds (IQR multiplier)
    OUTLIER_THRESHOLD = 3.0

    def __init__(self, cwicr_reference: pd.DataFrame = None):
        self.reference = cwicr_reference
        if cwicr_reference is not None:
            self._build_reference_stats()

    def _build_reference_stats(self):
        """Build reference statistics for outlier detection."""
        self._stats = {}

        for col in self.NUMERIC_FIELDS:
            if col in self.reference.columns:
                values = pd.to_numeric(self.reference[col], errors='coerce').dropna()
                if len(values) > 0:
                    self._stats[col] = {
                        'mean': values.mean(),
                        'std': values.std(),
                        'q1': values.quantile(0.25),
                        'q3': values.quantile(0.75),
                        'iqr': values.quantile(0.75) - values.quantile(0.25)
                    }

    def validate_dataframe(self, df: pd.DataFrame) -> ValidationResult:
        """Validate entire dataframe."""

        issues = []
        valid_count = 0

        for idx, row in df.iterrows():
            row_issues = self._validate_row(row, str(idx))
            issues.extend(row_issues)

            if not any(i.severity == ValidationSeverity.ERROR for i in row_issues):
                valid_count += 1

        # Check for duplicates
        if 'work_item_code' in df.columns:
            duplicates = df[df.duplicated(subset=['work_item_code'], keep=False)]
            for idx, row in duplicates.iterrows():
                issues.append(ValidationIssue(
                    field='work_item_code',
                    record_id=str(idx),
                    category=ValidationCategory.DUPLICATE,
                    severity=ValidationSeverity.WARNING,
                    message=f"Duplicate work item code: {row['work_item_code']}",
                    current_value=row['work_item_code'],
                    expected="Unique codes"
                ))

        error_count = sum(1 for i in issues if i.severity == ValidationSeverity.ERROR)
        warning_count = sum(1 for i in issues if i.severity == ValidationSeverity.WARNING)
        info_count = sum(1 for i in issues if i.severity == ValidationSeverity.INFO)

        return ValidationResult(
            total_records=len(df),
            valid_records=valid_count,
            issues=issues,
            error_count=error_count,
            warning_count=warning_count,
            info_count=info_count,
            validation_date=datetime.now(),
            passed=error_count == 0
        )

    def _validate_row(self, row: pd.Series, record_id: str) -> List[ValidationIssue]:
        """Validate single row."""

        issues = []

        # Check required fields
        for field in self.REQUIRED_FIELDS:
            if field in row.index:
                value = row[field]
                if pd.isna(value) or str(value).strip() == '':
                    issues.append(ValidationIssue(
                        field=field,
                        record_id=record_id,
                        category=ValidationCategory.MISSING_DATA,
                        severity=ValidationSeverity.ERROR,
                        message=f"Required field '{field}' is missing",
                        current_value=value,
                        expected="Non-empty value"
                    ))

        # Check numeric fields
        for field in self.NUMERIC_FIELDS:
            if field in row.index:
                value = row[field]
                if pd.notna(value):
                    try:
                        num_val = float(value)
                        # Check for negative where positive expected
                        if field in self.POSITIVE_FIELDS and num_val < 0:
                            issues.append(ValidationIssue(
                                field=field,
                                record_id=record_id,
                                category=ValidationCategory.INVALID_VALUE,
                                severity=ValidationSeverity.ERROR,
                                message=f"Negative value in '{field}'",
                                current_value=value,
                                expected="Positive number"
                            ))

                        # Check for outliers
                        if self._stats and field in self._stats:
                            stats = self._stats[field]
                            lower = stats['q1'] - self.OUTLIER_THRESHOLD * stats['iqr']
                            upper = stats['q3'] + self.OUTLIER_THRESHOLD * stats['iqr']

                            if num_val < lower or num_val > upper:
                                issues.append(ValidationIssue(
                                    field=field,
                                    record_id=record_id,
                                    category=ValidationCategory.OUTLIER,
                                    severity=ValidationSeverity.WARNING,
                                    message=f"Outlier value in '{field}'",
                                    current_value=value,
                                    expected=f"Between {lower:.2f} and {upper:.2f}"
                                ))

                    except (ValueError, TypeError):
                        issues.append(ValidationIssue(
                            field=field,
                            record_id=record_id,
                            category=ValidationCategory.INVALID_VALUE,
                            severity=ValidationSeverity.ERROR,
                            message=f"Non-numeric value in '{field}'",
                            current_value=value,
                            expected="Numeric value"
                        ))

        # Check work item code format
        if 'work_item_code' in row.index:
            code = row['work_item_code']
            if pd.notna(code) and not self._valid_code_format(str(code)):
                issues.append(ValidationIssue(
                    field='work_item_code',
                    record_id=record_id,
                    category=ValidationCategory.FORMAT,
                    severity=ValidationSeverity.INFO,
                    message="Non-standard code format",
                    current_value=code,
                    expected="CATEGORY-NUMBER format"
                ))

        return issues

    def _valid_code_format(self, code: str) -> bool:
        """Check if code follows expected format."""
        # Expect format like "CONC-001" or "EXCV-DEEP-002"
        parts = code.split('-')
        return len(parts) >= 2 and parts[0].isalpha()

    def validate_estimate(self,
                          items: List[Dict[str, Any]],
                          check_against_cwicr: bool = True) -> ValidationResult:
        """Validate estimate items."""

        issues = []
        valid_count = 0

        for i, item in enumerate(items):
            record_id = str(i)
            item_issues = []

            # Check required fields
            code = item.get('work_item_code', item.get('code'))
            if not code:
                item_issues.append(ValidationIssue(
                    field='work_item_code',
                    record_id=record_id,
                    category=ValidationCategory.MISSING_DATA,
                    severity=ValidationSeverity.ERROR,
                    message="Missing work item code",
                    current_value=None,
                    expected="Valid work item code"
                ))

            # Check quantity
            qty = item.get('quantity', 0)
            if qty <= 0:
                item_issues.append(ValidationIssue(
                    field='quantity',
                    record_id=record_id,
                    category=ValidationCategory.INVALID_VALUE,
                    severity=ValidationSeverity.ERROR,
                    message="Invalid quantity",
                    current_value=qty,
                    expected="Positive number"
                ))

            # Check against CWICR reference
            if check_against_cwicr and self.reference is not None and code:
                if 'work_item_code' in self.reference.columns:
                    if code not in self.reference['work_item_code'].values:
                        item_issues.append(ValidationIssue(
                            field='work_item_code',
                            record_id=record_id,
                            category=ValidationCategory.INVALID_VALUE,
                            severity=ValidationSeverity.WARNING,
                            message=f"Work item code not found in CWICR: {code}",
                            current_value=code,
                            expected="Valid CWICR code"
                        ))

            issues.extend(item_issues)

            if not any(i.severity == ValidationSeverity.ERROR for i in item_issues):
                valid_count += 1

        return ValidationResult(
            total_records=len(items),
            valid_records=valid_count,
            issues=issues,
            error_count=sum(1 for i in issues if i.severity == ValidationSeverity.ERROR),
            warning_count=sum(1 for i in issues if i.severity == ValidationSeverity.WARNING),
            info_count=sum(1 for i in issues if i.severity == ValidationSeverity.INFO),
            validation_date=datetime.now(),
            passed=all(i.severity != ValidationSeverity.ERROR for i in issues)
        )

    def get_data_quality_score(self, result: ValidationResult) -> Dict[str, Any]:
        """Calculate data quality score."""

        if result.total_records == 0:
            return {'score': 0, 'grade': 'N/A'}

        # Weighted scoring
        error_weight = 10
        warning_weight = 3
        info_weight = 1

        total_deductions = (
            result.error_count * error_weight +
            result.warning_count * warning_weight +
            result.info_count * info_weight
        )

        max_deductions = result.total_records * error_weight
        score = max(0, 100 - (total_deductions / max_deductions * 100)) if max_deductions > 0 else 100

        # Assign grade
        if score >= 95:
            grade = 'A'
        elif score >= 85:
            grade = 'B'
        elif score >= 75:
            grade = 'C'
        elif score >= 60:
            grade = 'D'
        else:
            grade = 'F'

        return {
            'score': round(score, 1),
            'grade': grade,
            'total_records': result.total_records,
            'valid_records': result.valid_records,
            'error_count': result.error_count,
            'warning_count': result.warning_count
        }

    def export_validation_report(self,
                                  result: ValidationResult,
                                  output_path: str) -> str:
        """Export validation report to Excel."""

        with pd.ExcelWriter(output_path, engine='openpyxl') as writer:
            # Summary
            quality = self.get_data_quality_score(result)
            summary_df = pd.DataFrame([{
                'Total Records': result.total_records,
                'Valid Records': result.valid_records,
                'Errors': result.error_count,
                'Warnings': result.warning_count,
                'Info': result.info_count,
                'Quality Score': quality['score'],
                'Grade': quality['grade'],
                'Validation Date': result.validation_date,
                'Passed': result.passed
            }])
            summary_df.to_excel(writer, sheet_name='Summary', index=False)

            # Issues
            if result.issues:
                issues_df = pd.DataFrame([
                    {
                        'Record': i.record_id,
                        'Field': i.field,
                        'Category': i.category.value,
                        'Severity': i.severity.value,
                        'Message': i.message,
                        'Current Value': str(i.current_value),
                        'Expected': i.expected
                    }
                    for i in result.issues
                ])
                issues_df.to_excel(writer, sheet_name='Issues', index=False)

        return output_path
```

## Quick Start

```python
# Load CWICR reference
cwicr = pd.read_parquet("ddc_cwicr_en.parquet")

# Initialize validator
validator = CWICRDataValidator(cwicr)

# Validate estimate
items = [
    {'work_item_code': 'CONC-001', 'quantity': 100},
    {'work_item_code': 'INVALID-CODE', 'quantity': -5}
]

result = validator.validate_estimate(items)
print(f"Passed: {result.passed}")
print(f"Errors: {result.error_count}")
```

## Common Use Cases

### 1. Data Quality Score
```python
quality = validator.get_data_quality_score(result)
print(f"Score: {quality['score']} ({quality['grade']})")
```

### 2. Validate DataFrame
```python
import_df = pd.read_excel("estimate_import.xlsx")
result = validator.validate_dataframe(import_df)

for issue in result.issues:
    if issue.severity == ValidationSeverity.ERROR:
        print(f"ERROR: {issue.message}")
```

### 3. Export Report
```python
validator.export_validation_report(result, "validation_report.xlsx")
```

## Resources
- **GitHub**: [OpenConstructionEstimate-Jens-CWICR](https://github.com/jens-construction/OpenConstructionEstimate-Jens-CWICR)
- **Jens Book**: Chapter 2.1 - Data Quality Management


---


# CWICR Equipment Planner

## Business Case

### Problem Statement
Equipment is a major cost driver:
- What equipment is needed?
- For how long?
- Rent or buy?
- How to optimize utilization?

### Solution
Equipment planning using CWICR equipment norms to calculate requirements, schedule usage, and analyze rental vs purchase decisions.

### Business Value
- **Accurate requirements** - Based on validated norms
- **Optimized utilization** - Reduce idle time
- **Cost analysis** - Rent vs buy decisions
- **Scheduling** - Equipment availability planning

## Technical Implementation

```python
import pandas as pd
import numpy as np
from typing import Dict, Any, List, Optional, Tuple
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum
from collections import defaultdict


class EquipmentCategory(Enum):
    """Equipment categories."""
    EARTHMOVING = "earthmoving"
    LIFTING = "lifting"
    CONCRETE = "concrete"
    COMPACTION = "compaction"
    TRANSPORT = "transport"
    POWER_TOOLS = "power_tools"
    SCAFFOLDING = "scaffolding"
    PUMPING = "pumping"
    PILING = "piling"
    OTHER = "other"


class OwnershipType(Enum):
    """Equipment ownership types."""
    OWNED = "owned"
    RENTED = "rented"
    LEASED = "leased"


@dataclass
class EquipmentItem:
    """Equipment item requirement."""
    equipment_code: str
    description: str
    category: EquipmentCategory
    required_hours: float
    required_days: int
    daily_rate: float
    hourly_rate: float
    monthly_rate: float
    total_cost: float
    utilization_rate: float
    operator_required: bool
    operator_cost: float
    fuel_cost: float
    start_date: datetime
    end_date: datetime
    work_item_codes: List[str] = field(default_factory=list)


@dataclass
class EquipmentPlan:
    """Complete equipment plan."""
    project_name: str
    total_equipment_cost: float
    total_operator_cost: float
    total_fuel_cost: float
    total_cost: float
    equipment_items: List[EquipmentItem]
    by_category: Dict[str, float]
    schedule: Dict[str, List[str]]


# Equipment categories and typical rates
EQUIPMENT_DATA = {
    'excavator': {
        'category': EquipmentCategory.EARTHMOVING,
        'daily_rate': 450,
        'hourly_rate': 75,
        'monthly_rate': 9000,
        'fuel_per_hour': 15,  # liters
        'operator_hourly': 45
    },
    'crane': {
        'category': EquipmentCategory.LIFTING,
        'daily_rate': 800,
        'hourly_rate': 150,
        'monthly_rate': 16000,
        'fuel_per_hour': 20,
        'operator_hourly': 55
    },
    'concrete_mixer': {
        'category': EquipmentCategory.CONCRETE,
        'daily_rate': 150,
        'hourly_rate': 25,
        'monthly_rate': 3000,
        'fuel_per_hour': 8,
        'operator_hourly': 35
    },
    'compactor': {
        'category': EquipmentCategory.COMPACTION,
        'daily_rate': 200,
        'hourly_rate': 35,
        'monthly_rate': 4000,
        'fuel_per_hour': 10,
        'operator_hourly': 40
    },
    'pump': {
        'category': EquipmentCategory.PUMPING,
        'daily_rate': 300,
        'hourly_rate': 50,
        'monthly_rate': 6000,
        'fuel_per_hour': 12,
        'operator_hourly': 40
    },
    'scaffold': {
        'category': EquipmentCategory.SCAFFOLDING,
        'daily_rate': 50,
        'hourly_rate': 0,
        'monthly_rate': 1000,
        'fuel_per_hour': 0,
        'operator_hourly': 0
    },
    'loader': {
        'category': EquipmentCategory.EARTHMOVING,
        'daily_rate': 350,
        'hourly_rate': 60,
        'monthly_rate': 7000,
        'fuel_per_hour': 12,
        'operator_hourly': 40
    },
    'truck': {
        'category': EquipmentCategory.TRANSPORT,
        'daily_rate': 250,
        'hourly_rate': 40,
        'monthly_rate': 5000,
        'fuel_per_hour': 15,
        'operator_hourly': 35
    }
}


class CWICREquipmentPlanner:
    """Plan equipment requirements from CWICR data."""

    def __init__(self, cwicr_data: pd.DataFrame,
                 fuel_price: float = 1.5):  # USD per liter
        self.work_items = cwicr_data
        self.fuel_price = fuel_price
        self._index_data()

    def _index_data(self):
        """Index work items for fast lookup."""
        if 'work_item_code' in self.work_items.columns:
            self._work_index = self.work_items.set_index('work_item_code')
        else:
            self._work_index = None

    def _get_equipment_info(self, description: str) -> Dict[str, Any]:
        """Get equipment info from description."""
        desc_lower = str(description).lower()

        for equip_name, info in EQUIPMENT_DATA.items():
            if equip_name in desc_lower:
                return info

        # Default equipment
        return {
            'category': EquipmentCategory.OTHER,
            'daily_rate': 200,
            'hourly_rate': 35,
            'monthly_rate': 4000,
            'fuel_per_hour': 10,
            'operator_hourly': 35
        }

    def extract_equipment_requirements(self,
                                        items: List[Dict[str, Any]],
                                        project_start: datetime = None) -> List[EquipmentItem]:
        """Extract equipment requirements from work items."""

        if project_start is None:
            project_start = datetime.now()

        equipment = defaultdict(lambda: {
            'hours': 0,
            'work_items': [],
            'start_day': float('inf'),
            'end_day': 0
        })

        for item in items:
            code = item.get('work_item_code', item.get('code'))
            qty = item.get('quantity', 0)
            start_day = item.get('start_day', 0)
            duration = item.get('duration_days', 1)

            if self._work_index is not None and code in self._work_index.index:
                work_item = self._work_index.loc[code]

                equipment_norm = float(work_item.get('equipment_norm', 0) or 0)
                equipment_desc = str(work_item.get('equipment_description',
                                                    work_item.get('category', 'General')))

                equip_hours = equipment_norm * qty

                if equip_hours > 0:
                    equip_key = equipment_desc
                    equipment[equip_key]['hours'] += equip_hours
                    equipment[equip_key]['work_items'].append(code)
                    equipment[equip_key]['description'] = equipment_desc
                    equipment[equip_key]['start_day'] = min(
                        equipment[equip_key]['start_day'], start_day
                    )
                    equipment[equip_key]['end_day'] = max(
                        equipment[equip_key]['end_day'], start_day + duration
                    )

        # Convert to EquipmentItem list
        result = []
        for equip_key, data in equipment.items():
            info = self._get_equipment_info(data['description'])
            hours = data['hours']

            # Calculate days needed
            days_needed = int(np.ceil(hours / 8))  # 8-hour days

            # Dates
            start_date = project_start + timedelta(days=data.get('start_day', 0))
            actual_days = max(days_needed, data.get('end_day', 0) - data.get('start_day', 0))
            end_date = start_date + timedelta(days=actual_days)

            # Utilization
            available_hours = actual_days * 8
            utilization = hours / available_hours if available_hours > 0 else 0

            # Costs
            equipment_cost = actual_days * info['daily_rate']
            operator_cost = hours * info['operator_hourly'] if info['operator_hourly'] > 0 else 0
            fuel_cost = hours * info['fuel_per_hour'] * self.fuel_price

            result.append(EquipmentItem(
                equipment_code=equip_key[:20],
                description=data['description'],
                category=info['category'],
                required_hours=round(hours, 1),
                required_days=actual_days,
                daily_rate=info['daily_rate'],
                hourly_rate=info['hourly_rate'],
                monthly_rate=info['monthly_rate'],
                total_cost=round(equipment_cost, 2),
                utilization_rate=round(utilization * 100, 1),
                operator_required=info['operator_hourly'] > 0,
                operator_cost=round(operator_cost, 2),
                fuel_cost=round(fuel_cost, 2),
                start_date=start_date,
                end_date=end_date,
                work_item_codes=data['work_items']
            ))

        return result

    def generate_equipment_plan(self,
                                items: List[Dict[str, Any]],
                                project_name: str = "Project") -> EquipmentPlan:
        """Generate complete equipment plan."""

        equipment = self.extract_equipment_requirements(items)

        # Totals
        total_equipment = sum(e.total_cost for e in equipment)
        total_operator = sum(e.operator_cost for e in equipment)
        total_fuel = sum(e.fuel_cost for e in equipment)

        # By category
        by_category = defaultdict(float)
        for e in equipment:
            by_category[e.category.value] += e.total_cost

        # Schedule (equipment by date)
        schedule = defaultdict(list)
        for e in equipment:
            current = e.start_date
            while current < e.end_date:
                date_key = current.strftime('%Y-%m-%d')
                schedule[date_key].append(e.description)
                current += timedelta(days=1)

        return EquipmentPlan(
            project_name=project_name,
            total_equipment_cost=total_equipment,
            total_operator_cost=total_operator,
            total_fuel_cost=total_fuel,
            total_cost=total_equipment + total_operator + total_fuel,
            equipment_items=equipment,
            by_category=dict(by_category),
            schedule=dict(schedule)
        )

    def rent_vs_buy_analysis(self,
                             equipment_item: EquipmentItem,
                             purchase_price: float,
                             useful_life_months: int = 60,
                             residual_value_pct: float = 0.20) -> Dict[str, Any]:
        """Analyze rent vs buy decision."""

        # Rental cost
        rental_cost = equipment_item.required_days * equipment_item.daily_rate

        # Ownership cost (simplified)
        monthly_depreciation = (purchase_price * (1 - residual_value_pct)) / useful_life_months
        months_needed = equipment_item.required_days / 30
        ownership_cost = monthly_depreciation * months_needed

        # Break-even analysis
        break_even_days = purchase_price / equipment_item.daily_rate
        break_even_months = break_even_days / 30

        return {
            'equipment': equipment_item.description,
            'rental_cost': round(rental_cost, 2),
            'ownership_cost_period': round(ownership_cost, 2),
            'purchase_price': purchase_price,
            'recommendation': 'RENT' if rental_cost < ownership_cost else 'BUY',
            'savings': abs(rental_cost - ownership_cost),
            'break_even_months': round(break_even_months, 1),
            'utilization_rate': equipment_item.utilization_rate
        }

    def optimize_utilization(self,
                             equipment: List[EquipmentItem],
                             target_utilization: float = 80.0) -> Dict[str, Any]:
        """Analyze and suggest utilization improvements."""

        analysis = {
            'underutilized': [],
            'well_utilized': [],
            'overutilized': [],
            'recommendations': []
        }

        for e in equipment:
            if e.utilization_rate < target_utilization - 20:
                analysis['underutilized'].append({
                    'equipment': e.description,
                    'utilization': e.utilization_rate,
                    'potential_saving': e.total_cost * (1 - e.utilization_rate / 100)
                })
                analysis['recommendations'].append(
                    f"Consider shorter rental period for {e.description} "
                    f"(current utilization: {e.utilization_rate}%)"
                )
            elif e.utilization_rate > target_utilization + 20:
                analysis['overutilized'].append({
                    'equipment': e.description,
                    'utilization': e.utilization_rate
                })
                analysis['recommendations'].append(
                    f"Consider additional unit of {e.description} to reduce strain"
                )
            else:
                analysis['well_utilized'].append({
                    'equipment': e.description,
                    'utilization': e.utilization_rate
                })

        analysis['average_utilization'] = np.mean([e.utilization_rate for e in equipment]) if equipment else 0

        return analysis

    def export_to_excel(self,
                       plan: EquipmentPlan,
                       output_path: str) -> str:
        """Export equipment plan to Excel."""

        with pd.ExcelWriter(output_path, engine='openpyxl') as writer:
            # Equipment list
            equip_df = pd.DataFrame([
                {
                    'Description': e.description,
                    'Category': e.category.value,
                    'Hours': e.required_hours,
                    'Days': e.required_days,
                    'Daily Rate': e.daily_rate,
                    'Equipment Cost': e.total_cost,
                    'Operator Cost': e.operator_cost,
                    'Fuel Cost': e.fuel_cost,
                    'Total Cost': e.total_cost + e.operator_cost + e.fuel_cost,
                    'Utilization %': e.utilization_rate,
                    'Start': e.start_date.strftime('%Y-%m-%d'),
                    'End': e.end_date.strftime('%Y-%m-%d')
                }
                for e in plan.equipment_items
            ])
            equip_df.to_excel(writer, sheet_name='Equipment', index=False)

            # Summary
            summary_df = pd.DataFrame([{
                'Total Equipment Cost': plan.total_equipment_cost,
                'Total Operator Cost': plan.total_operator_cost,
                'Total Fuel Cost': plan.total_fuel_cost,
                'Grand Total': plan.total_cost
            }])
            summary_df.to_excel(writer, sheet_name='Summary', index=False)

        return output_path
```

## Quick Start

```python
from datetime import datetime

# Load CWICR data
cwicr = pd.read_parquet("ddc_cwicr_en.parquet")

# Initialize planner
planner = CWICREquipmentPlanner(cwicr, fuel_price=1.5)

# Define work items
items = [
    {'work_item_code': 'EXCV-001', 'quantity': 500, 'start_day': 0, 'duration_days': 10},
    {'work_item_code': 'CONC-002', 'quantity': 200, 'start_day': 10, 'duration_days': 15}
]

# Generate plan
plan = planner.generate_equipment_plan(items, "Building A")

print(f"Equipment Cost: ${plan.total_equipment_cost:,.2f}")
print(f"Operator Cost: ${plan.total_operator_cost:,.2f}")
print(f"Total: ${plan.total_cost:,.2f}")
```

## Common Use Cases

### 1. Rent vs Buy Analysis
```python
for equip in plan.equipment_items:
    analysis = planner.rent_vs_buy_analysis(equip, purchase_price=50000)
    print(f"{equip.description}: {analysis['recommendation']}")
```

### 2. Utilization Optimization
```python
optimization = planner.optimize_utilization(plan.equipment_items)
for rec in optimization['recommendations']:
    print(rec)
```

### 3. Export Plan
```python
planner.export_to_excel(plan, "equipment_plan.xlsx")
```

## Resources
- **GitHub**: [OpenConstructionEstimate-Jens-CWICR](https://github.com/jens-construction/OpenConstructionEstimate-Jens-CWICR)
- **Jens Book**: Chapter 3.1 - Equipment Resource Planning


---


# CWICR Escalation Calculator

## Business Case

### Problem Statement
Construction costs change over time:
- Inflation affects all costs
- Material prices fluctuate
- Labor rates increase annually
- Long projects need escalation

### Solution
Time-based cost escalation using historical indices, projected rates, and category-specific escalation factors.

### Business Value
- **Future pricing** - Estimate costs at construction time
- **Budget planning** - Account for inflation
- **Contract pricing** - Escalation clauses
- **Historical analysis** - Adjust past costs to current

## Technical Implementation

```python
import pandas as pd
import numpy as np
from typing import Dict, Any, List, Optional, Tuple
from dataclasses import dataclass
from datetime import datetime, date
from dateutil.relativedelta import relativedelta
from enum import Enum


class EscalationType(Enum):
    """Types of escalation."""
    LABOR = "labor"
    MATERIAL = "material"
    EQUIPMENT = "equipment"
    GENERAL = "general"


@dataclass
class EscalationIndex:
    """Escalation index for a period."""
    period: str  # YYYY-MM
    labor_index: float
    material_index: float
    equipment_index: float
    general_index: float


@dataclass
class EscalationResult:
    """Result of escalation calculation."""
    base_cost: float
    base_date: date
    target_date: date
    months: int
    escalation_rate: float
    escalation_amount: float
    escalated_cost: float
    by_category: Dict[str, Dict[str, float]]


# Historical escalation rates (annual %)
HISTORICAL_RATES = {
    2020: {'labor': 2.5, 'material': 1.8, 'equipment': 1.5, 'general': 2.0},
    2021: {'labor': 3.2, 'material': 8.5, 'equipment': 2.0, 'general': 4.5},
    2022: {'labor': 4.5, 'material': 12.0, 'equipment': 3.5, 'general': 7.0},
    2023: {'labor': 4.0, 'material': 5.0, 'equipment': 3.0, 'general': 4.0},
    2024: {'labor': 3.5, 'material': 3.0, 'equipment': 2.5, 'general': 3.0},
    2025: {'labor': 3.0, 'material': 2.5, 'equipment': 2.0, 'general': 2.5},
}

# Material-specific escalation factors
MATERIAL_ESCALATION = {
    'steel': 1.20,      # Higher volatility
    'lumber': 1.30,     # High volatility
    'concrete': 0.90,   # Lower volatility
    'copper': 1.25,     # Commodity driven
    'aluminum': 1.15,
    'plastic': 1.10,
    'glass': 0.95,
    'default': 1.00
}


class CWICREscalation:
    """Calculate cost escalation over time."""

    def __init__(self,
                 cwicr_data: pd.DataFrame = None,
                 custom_rates: Dict[int, Dict[str, float]] = None):
        self.cost_data = cwicr_data
        self.rates = custom_rates or HISTORICAL_RATES
        if cwicr_data is not None:
            self._index_data()

    def _index_data(self):
        """Index cost data."""
        if 'work_item_code' in self.cost_data.columns:
            self._code_index = self.cost_data.set_index('work_item_code')
        else:
            self._code_index = None

    def get_rate(self,
                  year: int,
                  category: EscalationType = EscalationType.GENERAL) -> float:
        """Get escalation rate for year and category."""
        year_rates = self.rates.get(year, self.rates.get(max(self.rates.keys())))
        return year_rates.get(category.value, year_rates.get('general', 3.0))

    def calculate_compound_factor(self,
                                   base_date: date,
                                   target_date: date,
                                   category: EscalationType = EscalationType.GENERAL) -> float:
        """Calculate compound escalation factor between dates."""

        if target_date <= base_date:
            return 1.0

        factor = 1.0
        current = base_date

        while current < target_date:
            year = current.year
            annual_rate = self.get_rate(year, category) / 100

            # Calculate months in this year
            year_end = date(year + 1, 1, 1)
            if target_date < year_end:
                months = (target_date.year - current.year) * 12 + target_date.month - current.month
            else:
                months = (year_end.year - current.year) * 12 + year_end.month - current.month

            # Apply monthly compound rate
            monthly_rate = (1 + annual_rate) ** (1/12) - 1
            factor *= (1 + monthly_rate) ** months

            current = year_end

        return factor

    def escalate_cost(self,
                       base_cost: float,
                       base_date: date,
                       target_date: date,
                       cost_breakdown: Dict[str, float] = None) -> EscalationResult:
        """Escalate cost from base date to target date."""

        if cost_breakdown is None:
            cost_breakdown = {
                'labor': base_cost * 0.40,
                'material': base_cost * 0.45,
                'equipment': base_cost * 0.15
            }

        months = (target_date.year - base_date.year) * 12 + target_date.month - base_date.month

        # Escalate each category
        by_category = {}
        total_escalated = 0

        for category, amount in cost_breakdown.items():
            esc_type = EscalationType.LABOR if category == 'labor' else \
                       EscalationType.MATERIAL if category == 'material' else \
                       EscalationType.EQUIPMENT if category == 'equipment' else \
                       EscalationType.GENERAL

            factor = self.calculate_compound_factor(base_date, target_date, esc_type)
            escalated = amount * factor
            escalation = escalated - amount

            by_category[category] = {
                'base': round(amount, 2),
                'factor': round(factor, 4),
                'escalated': round(escalated, 2),
                'escalation': round(escalation, 2)
            }

            total_escalated += escalated

        total_escalation = total_escalated - base_cost
        esc_rate = (total_escalation / base_cost * 100) if base_cost > 0 else 0

        return EscalationResult(
            base_cost=round(base_cost, 2),
            base_date=base_date,
            target_date=target_date,
            months=months,
            escalation_rate=round(esc_rate, 2),
            escalation_amount=round(total_escalation, 2),
            escalated_cost=round(total_escalated, 2),
            by_category=by_category
        )

    def escalate_estimate(self,
                           items: List[Dict[str, Any]],
                           base_date: date,
                           target_date: date) -> Dict[str, Any]:
        """Escalate entire estimate."""

        escalated_items = []
        total_base = 0
        total_escalated = 0

        for item in items:
            code = item.get('work_item_code', item.get('code'))
            qty = item.get('quantity', 0)

            # Get costs from CWICR
            labor = 0
            material = 0
            equipment = 0

            if self._code_index is not None and code in self._code_index.index:
                wi = self._code_index.loc[code]
                labor = float(wi.get('labor_cost', 0) or 0) * qty
                material = float(wi.get('material_cost', 0) or 0) * qty
                equipment = float(wi.get('equipment_cost', 0) or 0) * qty

            base = labor + material + equipment
            breakdown = {'labor': labor, 'material': material, 'equipment': equipment}

            result = self.escalate_cost(base, base_date, target_date, breakdown)

            escalated_items.append({
                'code': code,
                'base_cost': result.base_cost,
                'escalated_cost': result.escalated_cost,
                'escalation': result.escalation_amount
            })

            total_base += base
            total_escalated += result.escalated_cost

        return {
            'items': escalated_items,
            'total_base': round(total_base, 2),
            'total_escalated': round(total_escalated, 2),
            'total_escalation': round(total_escalated - total_base, 2),
            'escalation_rate': round((total_escalated - total_base) / total_base * 100, 2) if total_base > 0 else 0,
            'base_date': base_date,
            'target_date': target_date
        }

    def project_future_costs(self,
                              base_cost: float,
                              base_date: date,
                              years_forward: int = 5,
                              annual_rate: float = None) -> pd.DataFrame:
        """Project costs for multiple future years."""

        projections = []
        current = base_cost

        for i in range(years_forward + 1):
            target = base_date + relativedelta(years=i)
            year = target.year

            if annual_rate is None:
                rate = self.get_rate(year)
            else:
                rate = annual_rate

            if i > 0:
                current = current * (1 + rate / 100)

            projections.append({
                'Year': year,
                'Date': target,
                'Annual Rate': f"{rate}%",
                'Projected Cost': round(current, 2),
                'Cumulative Escalation': round(current - base_cost, 2),
                'Cumulative %': round((current - base_cost) / base_cost * 100, 1)
            })

        return pd.DataFrame(projections)

    def de_escalate_cost(self,
                          current_cost: float,
                          current_date: date,
                          base_date: date,
                          category: EscalationType = EscalationType.GENERAL) -> Dict[str, Any]:
        """De-escalate current cost back to base date."""

        factor = self.calculate_compound_factor(base_date, current_date, category)
        base_cost = current_cost / factor

        return {
            'current_cost': round(current_cost, 2),
            'current_date': current_date,
            'base_date': base_date,
            'de_escalation_factor': round(1 / factor, 4),
            'base_cost': round(base_cost, 2),
            'category': category.value
        }

    def export_escalation(self,
                          result: EscalationResult,
                          output_path: str) -> str:
        """Export escalation to Excel."""

        with pd.ExcelWriter(output_path, engine='openpyxl') as writer:
            # Summary
            summary_df = pd.DataFrame([{
                'Base Cost': result.base_cost,
                'Base Date': result.base_date,
                'Target Date': result.target_date,
                'Months': result.months,
                'Escalation Rate': f"{result.escalation_rate}%",
                'Escalation Amount': result.escalation_amount,
                'Escalated Cost': result.escalated_cost
            }])
            summary_df.to_excel(writer, sheet_name='Summary', index=False)

            # By Category
            cat_df = pd.DataFrame([
                {
                    'Category': cat,
                    'Base': data['base'],
                    'Factor': data['factor'],
                    'Escalated': data['escalated'],
                    'Escalation': data['escalation']
                }
                for cat, data in result.by_category.items()
            ])
            cat_df.to_excel(writer, sheet_name='By Category', index=False)

        return output_path
```

## Quick Start

```python
from datetime import date

# Initialize escalation calculator
esc = CWICREscalation()

# Escalate single cost
result = esc.escalate_cost(
    base_cost=1000000,
    base_date=date(2024, 1, 1),
    target_date=date(2026, 6, 1)
)

print(f"Base Cost: ${result.base_cost:,.2f}")
print(f"Escalated: ${result.escalated_cost:,.2f}")
print(f"Escalation: {result.escalation_rate}%")
```

## Common Use Cases

### 1. Project Future Costs
```python
projections = esc.project_future_costs(
    base_cost=5000000,
    base_date=date.today(),
    years_forward=5
)
print(projections)
```

### 2. Escalate Estimate
```python
cwicr = pd.read_parquet("ddc_cwicr_en.parquet")
esc = CWICREscalation(cwicr)

items = [
    {'work_item_code': 'CONC-001', 'quantity': 150},
    {'work_item_code': 'STRL-002', 'quantity': 25}
]

escalated = esc.escalate_estimate(
    items,
    base_date=date(2024, 1, 1),
    target_date=date(2025, 12, 1)
)
```

### 3. De-escalate Historical Cost
```python
base_cost = esc.de_escalate_cost(
    current_cost=1200000,
    current_date=date(2024, 6, 1),
    base_date=date(2020, 1, 1)
)
print(f"2020 equivalent: ${base_cost['base_cost']:,.2f}")
```

## Resources
- **GitHub**: [OpenConstructionEstimate-Jens-CWICR](https://github.com/jens-construction/OpenConstructionEstimate-Jens-CWICR)
- **Jens Book**: Chapter 3.1 - Cost Escalation Methods


---


# CWICR Historical Cost Tracker

## Business Case

### Problem Statement
Improving estimates requires:
- Actual cost feedback
- Historical comparisons
- Trend analysis
- Lessons learned

### Solution
Track actual costs against CWICR estimates, build historical database, and use data to improve future estimating accuracy.

### Business Value
- **Accuracy improvement** - Learn from actuals
- **Benchmarking** - Project comparisons
- **Trend analysis** - Cost movement patterns
- **Organizational knowledge** - Cost database

## Technical Implementation

```python
import pandas as pd
import numpy as np
from typing import Dict, Any, List, Optional
from dataclasses import dataclass, field
from datetime import datetime, date
from enum import Enum
import json


class ProjectStatus(Enum):
    """Project status."""
    ESTIMATED = "estimated"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


@dataclass
class CostRecord:
    """Historical cost record."""
    project_id: str
    project_name: str
    work_item_code: str
    quantity: float
    estimated_cost: float
    actual_cost: float
    variance: float
    variance_percent: float
    completion_date: date
    notes: str = ""


@dataclass
class ProjectCostSummary:
    """Project cost summary."""
    project_id: str
    project_name: str
    project_type: str
    location: str
    status: ProjectStatus
    estimated_total: float
    actual_total: float
    variance: float
    variance_percent: float
    start_date: date
    completion_date: Optional[date]
    item_count: int


class CWICRHistoricalCost:
    """Track historical costs using CWICR data."""

    def __init__(self, cwicr_data: pd.DataFrame = None):
        self.cwicr = cwicr_data
        self._projects: Dict[str, ProjectCostSummary] = {}
        self._records: List[CostRecord] = []

        if cwicr_data is not None:
            self._index_cwicr()

    def _index_cwicr(self):
        """Index CWICR data."""
        if 'work_item_code' in self.cwicr.columns:
            self._cwicr_index = self.cwicr.set_index('work_item_code')
        else:
            self._cwicr_index = None

    def add_project(self,
                    project_id: str,
                    project_name: str,
                    project_type: str,
                    location: str,
                    estimated_total: float,
                    start_date: date) -> str:
        """Add new project to historical database."""

        summary = ProjectCostSummary(
            project_id=project_id,
            project_name=project_name,
            project_type=project_type,
            location=location,
            status=ProjectStatus.ESTIMATED,
            estimated_total=estimated_total,
            actual_total=0,
            variance=0,
            variance_percent=0,
            start_date=start_date,
            completion_date=None,
            item_count=0
        )

        self._projects[project_id] = summary
        return project_id

    def record_actual_cost(self,
                           project_id: str,
                           work_item_code: str,
                           quantity: float,
                           actual_cost: float,
                           completion_date: date = None,
                           notes: str = "") -> CostRecord:
        """Record actual cost for work item."""

        # Get estimated cost from CWICR
        estimated_unit_cost = 0
        if self._cwicr_index is not None and work_item_code in self._cwicr_index.index:
            item = self._cwicr_index.loc[work_item_code]
            labor = float(item.get('labor_cost', 0) or 0)
            material = float(item.get('material_cost', 0) or 0)
            equipment = float(item.get('equipment_cost', 0) or 0)
            estimated_unit_cost = labor + material + equipment

        estimated_cost = estimated_unit_cost * quantity
        variance = actual_cost - estimated_cost
        variance_pct = (variance / estimated_cost * 100) if estimated_cost > 0 else 0

        record = CostRecord(
            project_id=project_id,
            project_name=self._projects.get(project_id, {}).project_name if project_id in self._projects else "",
            work_item_code=work_item_code,
            quantity=quantity,
            estimated_cost=round(estimated_cost, 2),
            actual_cost=round(actual_cost, 2),
            variance=round(variance, 2),
            variance_percent=round(variance_pct, 1),
            completion_date=completion_date or date.today(),
            notes=notes
        )

        self._records.append(record)

        # Update project summary
        if project_id in self._projects:
            proj = self._projects[project_id]
            proj.actual_total += actual_cost
            proj.variance = proj.actual_total - proj.estimated_total
            proj.variance_percent = (proj.variance / proj.estimated_total * 100) if proj.estimated_total > 0 else 0
            proj.item_count += 1
            proj.status = ProjectStatus.IN_PROGRESS

        return record

    def complete_project(self, project_id: str, completion_date: date = None):
        """Mark project as completed."""
        if project_id in self._projects:
            self._projects[project_id].status = ProjectStatus.COMPLETED
            self._projects[project_id].completion_date = completion_date or date.today()

    def get_work_item_history(self, work_item_code: str) -> Dict[str, Any]:
        """Get historical data for specific work item."""

        records = [r for r in self._records if r.work_item_code == work_item_code]

        if not records:
            return {'work_item_code': work_item_code, 'records': 0}

        variances = [r.variance_percent for r in records]
        actual_costs = [r.actual_cost / r.quantity if r.quantity > 0 else 0 for r in records]

        return {
            'work_item_code': work_item_code,
            'records': len(records),
            'average_variance_pct': round(np.mean(variances), 1),
            'variance_std': round(np.std(variances), 1),
            'average_actual_unit_cost': round(np.mean(actual_costs), 2),
            'min_actual_unit_cost': round(min(actual_costs), 2),
            'max_actual_unit_cost': round(max(actual_costs), 2),
            'projects': list(set(r.project_id for r in records)),
            'trend': 'increasing' if len(records) > 2 and actual_costs[-1] > actual_costs[0] else 'stable'
        }

    def get_accuracy_metrics(self) -> Dict[str, Any]:
        """Calculate overall estimating accuracy metrics."""

        if not self._records:
            return {}

        variances = [r.variance_percent for r in self._records]

        # Accuracy by category
        by_category = {}
        for record in self._records:
            category = record.work_item_code.split('-')[0] if '-' in record.work_item_code else 'Other'
            if category not in by_category:
                by_category[category] = []
            by_category[category].append(record.variance_percent)

        category_accuracy = {
            cat: {
                'average_variance': round(np.mean(vals), 1),
                'count': len(vals)
            }
            for cat, vals in by_category.items()
        }

        return {
            'total_records': len(self._records),
            'average_variance_pct': round(np.mean(variances), 1),
            'variance_std': round(np.std(variances), 1),
            'within_5pct': sum(1 for v in variances if abs(v) <= 5) / len(variances) * 100,
            'within_10pct': sum(1 for v in variances if abs(v) <= 10) / len(variances) * 100,
            'overestimated_pct': sum(1 for v in variances if v < 0) / len(variances) * 100,
            'underestimated_pct': sum(1 for v in variances if v > 0) / len(variances) * 100,
            'by_category': category_accuracy
        }

    def suggest_adjustment_factors(self) -> Dict[str, float]:
        """Suggest adjustment factors based on historical variance."""

        factors = {}

        for record in self._records:
            category = record.work_item_code.split('-')[0] if '-' in record.work_item_code else 'Other'
            if category not in factors:
                factors[category] = []

            if record.estimated_cost > 0:
                actual_factor = record.actual_cost / record.estimated_cost
                factors[category].append(actual_factor)

        return {
            cat: round(np.mean(vals), 3)
            for cat, vals in factors.items()
            if len(vals) >= 3  # Require minimum data points
        }

    def compare_projects(self,
                          project_ids: List[str] = None) -> pd.DataFrame:
        """Compare multiple projects."""

        if project_ids:
            projects = [self._projects[pid] for pid in project_ids if pid in self._projects]
        else:
            projects = list(self._projects.values())

        if not projects:
            return pd.DataFrame()

        return pd.DataFrame([
            {
                'Project ID': p.project_id,
                'Project Name': p.project_name,
                'Type': p.project_type,
                'Location': p.location,
                'Status': p.status.value,
                'Estimated': p.estimated_total,
                'Actual': p.actual_total,
                'Variance': p.variance,
                'Variance %': p.variance_percent,
                'Items': p.item_count
            }
            for p in projects
        ])

    def get_benchmarks_by_type(self, project_type: str) -> Dict[str, Any]:
        """Get cost benchmarks for project type."""

        projects = [p for p in self._projects.values() if p.project_type == project_type]

        if not projects:
            return {}

        actuals = [p.actual_total for p in projects if p.status == ProjectStatus.COMPLETED]

        return {
            'project_type': project_type,
            'completed_projects': len(actuals),
            'average_cost': round(np.mean(actuals), 2) if actuals else 0,
            'min_cost': round(min(actuals), 2) if actuals else 0,
            'max_cost': round(max(actuals), 2) if actuals else 0,
            'average_variance': round(np.mean([p.variance_percent for p in projects]), 1)
        }

    def export_historical_data(self, output_path: str) -> str:
        """Export historical data to Excel."""

        with pd.ExcelWriter(output_path, engine='openpyxl') as writer:
            # Projects
            if self._projects:
                projects_df = self.compare_projects()
                projects_df.to_excel(writer, sheet_name='Projects', index=False)

            # Records
            if self._records:
                records_df = pd.DataFrame([
                    {
                        'Project': r.project_id,
                        'Work Item': r.work_item_code,
                        'Quantity': r.quantity,
                        'Estimated': r.estimated_cost,
                        'Actual': r.actual_cost,
                        'Variance': r.variance,
                        'Variance %': r.variance_percent,
                        'Date': r.completion_date,
                        'Notes': r.notes
                    }
                    for r in self._records
                ])
                records_df.to_excel(writer, sheet_name='Records', index=False)

            # Accuracy metrics
            metrics = self.get_accuracy_metrics()
            if metrics:
                metrics_df = pd.DataFrame([{
                    'Total Records': metrics.get('total_records', 0),
                    'Avg Variance %': metrics.get('average_variance_pct', 0),
                    'Within 5%': f"{metrics.get('within_5pct', 0):.1f}%",
                    'Within 10%': f"{metrics.get('within_10pct', 0):.1f}%"
                }])
                metrics_df.to_excel(writer, sheet_name='Accuracy', index=False)

        return output_path

    def save_database(self, filepath: str):
        """Save historical database to JSON."""
        data = {
            'projects': {
                pid: {
                    'project_id': p.project_id,
                    'project_name': p.project_name,
                    'project_type': p.project_type,
                    'location': p.location,
                    'status': p.status.value,
                    'estimated_total': p.estimated_total,
                    'actual_total': p.actual_total,
                    'start_date': p.start_date.isoformat(),
                    'completion_date': p.completion_date.isoformat() if p.completion_date else None
                }
                for pid, p in self._projects.items()
            },
            'records': [
                {
                    'project_id': r.project_id,
                    'work_item_code': r.work_item_code,
                    'quantity': r.quantity,
                    'estimated_cost': r.estimated_cost,
                    'actual_cost': r.actual_cost,
                    'completion_date': r.completion_date.isoformat(),
                    'notes': r.notes
                }
                for r in self._records
            ]
        }

        with open(filepath, 'w') as f:
            json.dump(data, f, indent=2)
```

## Quick Start

```python
from datetime import date

# Load CWICR data
cwicr = pd.read_parquet("ddc_cwicr_en.parquet")

# Initialize tracker
tracker = CWICRHistoricalCost(cwicr)

# Add project
tracker.add_project(
    project_id="PROJ-001",
    project_name="Office Building A",
    project_type="commercial",
    location="New York",
    estimated_total=5000000,
    start_date=date(2024, 1, 1)
)

# Record actual costs
tracker.record_actual_cost(
    project_id="PROJ-001",
    work_item_code="CONC-001",
    quantity=200,
    actual_cost=32000,
    notes="Slightly over due to overtime"
)
```

## Common Use Cases

### 1. Accuracy Analysis
```python
metrics = tracker.get_accuracy_metrics()
print(f"Within 10%: {metrics['within_10pct']:.1f}%")
```

### 2. Adjustment Factors
```python
factors = tracker.suggest_adjustment_factors()
for cat, factor in factors.items():
    print(f"{cat}: {factor:.2f}x")
```

### 3. Work Item History
```python
history = tracker.get_work_item_history("CONC-001")
print(f"Average variance: {history['average_variance_pct']}%")
```

## Resources
- **GitHub**: [OpenConstructionEstimate-Jens-CWICR](https://github.com/jens-construction/OpenConstructionEstimate-Jens-CWICR)
- **Jens Book**: Chapter 3.2 - Historical Cost Analysis


---


# CWICR Labor Scheduler

## Business Case

### Problem Statement
Project managers need to plan labor allocation:
- How many workers per day?
- What skills are needed when?
- How to balance workload across project phases?
- How to avoid resource conflicts?

### Solution
Data-driven labor scheduling using CWICR labor norms to generate crew schedules, loading curves, and skill requirement timelines.

### Business Value
- **Accurate planning** - Based on validated labor norms
- **Resource leveling** - Smooth workload distribution
- **Skill matching** - Right workers at right time
- **Cost control** - Optimize labor costs

## Technical Implementation

```python
import pandas as pd
import numpy as np
from typing import Dict, Any, List, Optional, Tuple
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum
from collections import defaultdict


class ShiftType(Enum):
    """Work shift types."""
    SINGLE = "single"      # 8 hours
    DOUBLE = "double"      # 16 hours (2 shifts)
    TRIPLE = "triple"      # 24 hours (3 shifts)
    EXTENDED = "extended"  # 10 hours


class SkillLevel(Enum):
    """Worker skill levels."""
    UNSKILLED = 1
    SEMI_SKILLED = 2
    SKILLED = 3
    FOREMAN = 4
    SPECIALIST = 5


@dataclass
class LaborRequirement:
    """Labor requirement for a work item."""
    work_item_code: str
    description: str
    total_hours: float
    skill_level: SkillLevel
    trade: str
    start_date: datetime
    end_date: datetime
    daily_hours: float = 0.0


@dataclass
class CrewAssignment:
    """Crew assignment for a period."""
    date: datetime
    trade: str
    skill_level: SkillLevel
    workers_needed: int
    hours_per_worker: float
    total_hours: float
    work_items: List[str]


@dataclass
class LaborSchedule:
    """Complete labor schedule."""
    project_name: str
    start_date: datetime
    end_date: datetime
    total_labor_hours: float
    peak_workers: int
    average_workers: float
    assignments: List[CrewAssignment]
    daily_loading: Dict[str, int]
    by_trade: Dict[str, float]


class CWICRLaborScheduler:
    """Schedule labor based on CWICR norms."""

    HOURS_PER_SHIFT = {
        ShiftType.SINGLE: 8,
        ShiftType.DOUBLE: 16,
        ShiftType.TRIPLE: 24,
        ShiftType.EXTENDED: 10
    }

    def __init__(self, cwicr_data: pd.DataFrame):
        self.data = cwicr_data
        self._index_data()

    def _index_data(self):
        """Index work items for fast lookup."""
        if 'work_item_code' in self.data.columns:
            self._code_index = self.data.set_index('work_item_code')
        else:
            self._code_index = None

    def calculate_labor_requirements(self,
                                     items: List[Dict[str, Any]],
                                     project_start: datetime) -> List[LaborRequirement]:
        """Calculate labor requirements from work items."""

        requirements = []

        for item in items:
            code = item.get('work_item_code', item.get('code'))
            qty = item.get('quantity', 0)
            duration_days = item.get('duration_days', 1)
            start_offset = item.get('start_day', 0)

            if self._code_index is not None and code in self._code_index.index:
                work_item = self._code_index.loc[code]
                labor_norm = float(work_item.get('labor_norm', 0) or 0)
                total_hours = labor_norm * qty

                # Determine trade from category
                trade = self._get_trade(work_item.get('category', 'General'))
                skill_level = self._get_skill_level(work_item)

                start_date = project_start + timedelta(days=start_offset)
                end_date = start_date + timedelta(days=duration_days)

                daily_hours = total_hours / duration_days if duration_days > 0 else total_hours

                requirements.append(LaborRequirement(
                    work_item_code=code,
                    description=str(work_item.get('description', '')),
                    total_hours=total_hours,
                    skill_level=skill_level,
                    trade=trade,
                    start_date=start_date,
                    end_date=end_date,
                    daily_hours=daily_hours
                ))

        return requirements

    def _get_trade(self, category: str) -> str:
        """Map category to trade."""
        trade_mapping = {
            'concrete': 'Concrete',
            'masonry': 'Masonry',
            'steel': 'Steel',
            'carpentry': 'Carpentry',
            'plumbing': 'Plumbing',
            'electrical': 'Electrical',
            'hvac': 'HVAC',
            'painting': 'Painting',
            'excavation': 'Earthwork',
            'roofing': 'Roofing'
        }

        cat_lower = str(category).lower()
        for key, trade in trade_mapping.items():
            if key in cat_lower:
                return trade
        return 'General'

    def _get_skill_level(self, work_item) -> SkillLevel:
        """Determine skill level from work item."""
        # Based on complexity or explicit field
        if 'skill_level' in work_item.index:
            level = int(work_item.get('skill_level', 3))
            return SkillLevel(min(max(level, 1), 5))
        return SkillLevel.SKILLED

    def generate_schedule(self,
                         requirements: List[LaborRequirement],
                         shift_type: ShiftType = ShiftType.SINGLE,
                         max_workers_per_trade: int = 50) -> LaborSchedule:
        """Generate labor schedule from requirements."""

        if not requirements:
            return LaborSchedule(
                project_name="",
                start_date=datetime.now(),
                end_date=datetime.now(),
                total_labor_hours=0,
                peak_workers=0,
                average_workers=0,
                assignments=[],
                daily_loading={},
                by_trade={}
            )

        hours_per_day = self.HOURS_PER_SHIFT[shift_type]

        # Find date range
        start_date = min(r.start_date for r in requirements)
        end_date = max(r.end_date for r in requirements)

        # Build daily labor loading
        daily_loading = defaultdict(lambda: defaultdict(float))

        for req in requirements:
            current = req.start_date
            while current < req.end_date:
                date_key = current.strftime('%Y-%m-%d')
                daily_loading[date_key][req.trade] += req.daily_hours
                current += timedelta(days=1)

        # Convert to crew assignments
        assignments = []
        daily_totals = {}
        by_trade = defaultdict(float)

        for date_key, trades in daily_loading.items():
            date = datetime.strptime(date_key, '%Y-%m-%d')
            day_total = 0

            for trade, hours in trades.items():
                workers = int(np.ceil(hours / hours_per_day))
                workers = min(workers, max_workers_per_trade)

                assignments.append(CrewAssignment(
                    date=date,
                    trade=trade,
                    skill_level=SkillLevel.SKILLED,
                    workers_needed=workers,
                    hours_per_worker=hours_per_day,
                    total_hours=hours,
                    work_items=[]
                ))

                day_total += workers
                by_trade[trade] += hours

            daily_totals[date_key] = day_total

        # Statistics
        total_hours = sum(r.total_hours for r in requirements)
        peak_workers = max(daily_totals.values()) if daily_totals else 0
        avg_workers = sum(daily_totals.values()) / len(daily_totals) if daily_totals else 0

        return LaborSchedule(
            project_name="Project",
            start_date=start_date,
            end_date=end_date,
            total_labor_hours=total_hours,
            peak_workers=peak_workers,
            average_workers=round(avg_workers, 1),
            assignments=assignments,
            daily_loading=dict(daily_totals),
            by_trade=dict(by_trade)
        )

    def level_resources(self,
                       schedule: LaborSchedule,
                       target_workers: int) -> LaborSchedule:
        """Level resources to target workforce size."""

        # Resource leveling algorithm
        # Shifts work to reduce peaks while maintaining total hours

        daily_loads = schedule.daily_loading.copy()

        # Find days exceeding target
        over_days = {d: w for d, w in daily_loads.items() if w > target_workers}
        under_days = {d: w for d, w in daily_loads.items() if w < target_workers}

        # Simple leveling: can't easily shift without changing durations
        # Return schedule with analysis

        leveling_analysis = {
            'days_over_target': len(over_days),
            'days_under_target': len(under_days),
            'max_over': max(over_days.values()) - target_workers if over_days else 0,
            'leveling_possible': len(over_days) == 0
        }

        return schedule

    def generate_loading_curve(self,
                               schedule: LaborSchedule) -> pd.DataFrame:
        """Generate labor loading curve data."""

        data = []
        for date_str, workers in sorted(schedule.daily_loading.items()):
            data.append({
                'date': date_str,
                'workers': workers,
                'cumulative_hours': 0  # Would need to calculate
            })

        df = pd.DataFrame(data)

        # Add cumulative hours
        if not df.empty:
            hours_per_worker = 8  # Assuming single shift
            df['daily_hours'] = df['workers'] * hours_per_worker
            df['cumulative_hours'] = df['daily_hours'].cumsum()

        return df

    def get_trade_breakdown(self,
                           schedule: LaborSchedule) -> pd.DataFrame:
        """Get labor breakdown by trade."""

        trade_data = []
        for trade, hours in schedule.by_trade.items():
            trade_data.append({
                'trade': trade,
                'total_hours': round(hours, 1),
                'worker_days': round(hours / 8, 1),
                'percentage': round(hours / schedule.total_labor_hours * 100, 1) if schedule.total_labor_hours > 0 else 0
            })

        return pd.DataFrame(trade_data).sort_values('total_hours', ascending=False)

    def optimize_crew_composition(self,
                                  requirements: List[LaborRequirement],
                                  available_workers: Dict[str, int]) -> Dict[str, Any]:
        """Optimize crew composition based on availability."""

        required_by_trade = defaultdict(float)
        for req in requirements:
            required_by_trade[req.trade] += req.total_hours

        analysis = {
            'sufficient': True,
            'shortages': {},
            'surplus': {},
            'recommendations': []
        }

        for trade, hours_needed in required_by_trade.items():
            workers_needed = int(np.ceil(hours_needed / 8))  # Per day
            available = available_workers.get(trade, 0)

            if workers_needed > available:
                analysis['sufficient'] = False
                analysis['shortages'][trade] = workers_needed - available
                analysis['recommendations'].append(
                    f"Hire {workers_needed - available} additional {trade} workers"
                )
            elif available > workers_needed * 1.5:
                analysis['surplus'][trade] = available - workers_needed

        return analysis


class WeeklyScheduleGenerator:
    """Generate weekly labor schedules."""

    def __init__(self, scheduler: CWICRLaborScheduler):
        self.scheduler = scheduler

    def generate_weekly_schedule(self,
                                 schedule: LaborSchedule,
                                 week_start: datetime) -> pd.DataFrame:
        """Generate schedule for specific week."""

        week_end = week_start + timedelta(days=7)

        weekly_assignments = [
            a for a in schedule.assignments
            if week_start <= a.date < week_end
        ]

        # Pivot by day and trade
        data = []
        for a in weekly_assignments:
            data.append({
                'date': a.date.strftime('%Y-%m-%d'),
                'day': a.date.strftime('%A'),
                'trade': a.trade,
                'workers': a.workers_needed,
                'hours': a.total_hours
            })

        return pd.DataFrame(data)

    def export_to_excel(self,
                       schedule: LaborSchedule,
                       output_path: str) -> str:
        """Export schedule to Excel."""

        with pd.ExcelWriter(output_path, engine='openpyxl') as writer:
            # Loading curve
            loading = self.scheduler.generate_loading_curve(schedule)
            loading.to_excel(writer, sheet_name='Loading Curve', index=False)

            # Trade breakdown
            trades = self.scheduler.get_trade_breakdown(schedule)
            trades.to_excel(writer, sheet_name='By Trade', index=False)

            # Summary
            summary = pd.DataFrame([{
                'Total Labor Hours': schedule.total_labor_hours,
                'Peak Workers': schedule.peak_workers,
                'Average Workers': schedule.average_workers,
                'Project Duration (days)': (schedule.end_date - schedule.start_date).days
            }])
            summary.to_excel(writer, sheet_name='Summary', index=False)

        return output_path
```

## Quick Start

```python
from datetime import datetime

# Load CWICR data
cwicr = pd.read_parquet("ddc_cwicr_en.parquet")

# Initialize scheduler
scheduler = CWICRLaborScheduler(cwicr)

# Define work items with schedule
items = [
    {'work_item_code': 'EXCV-001', 'quantity': 500, 'duration_days': 5, 'start_day': 0},
    {'work_item_code': 'CONC-002', 'quantity': 200, 'duration_days': 10, 'start_day': 5},
    {'work_item_code': 'REBAR-003', 'quantity': 5000, 'duration_days': 8, 'start_day': 3}
]

# Calculate requirements
project_start = datetime(2024, 6, 1)
requirements = scheduler.calculate_labor_requirements(items, project_start)

# Generate schedule
schedule = scheduler.generate_schedule(requirements)

print(f"Total Labor Hours: {schedule.total_labor_hours:,.0f}")
print(f"Peak Workers: {schedule.peak_workers}")
print(f"Average Workers: {schedule.average_workers}")
```

## Common Use Cases

### 1. Resource Leveling
```python
# Check if schedule can meet target
leveled = scheduler.level_resources(schedule, target_workers=25)
```

### 2. Loading Curve
```python
# Get labor loading data for charts
loading_df = scheduler.generate_loading_curve(schedule)
```

### 3. Trade Breakdown
```python
# See hours by trade
trades = scheduler.get_trade_breakdown(schedule)
print(trades)
```

### 4. Weekly Schedule Export
```python
gen = WeeklyScheduleGenerator(scheduler)
gen.export_to_excel(schedule, "labor_schedule.xlsx")
```

## Resources
- **GitHub**: [OpenConstructionEstimate-Jens-CWICR](https://github.com/jens-construction/OpenConstructionEstimate-Jens-CWICR)
- **Jens Book**: Chapter 3.1 - Labor Resource Planning


---


# CWICR Location Factor

## Business Case

### Problem Statement
Construction costs vary by location:
- Labor rates differ by region
- Material prices vary geographically
- Market conditions affect costs
- Remote locations have premiums

### Solution
Apply location-based cost factors to CWICR estimates, adjusting for regional differences in labor, materials, and overall market conditions.

### Business Value
- **Regional accuracy** - Location-specific estimates
- **Market awareness** - Current conditions
- **Comparison support** - Normalize across locations
- **Planning** - Multi-location projects

## Technical Implementation

```python
import pandas as pd
from typing import Dict, Any, List, Optional
from dataclasses import dataclass
from enum import Enum


class CostComponent(Enum):
    """Cost components for factors."""
    LABOR = "labor"
    MATERIAL = "material"
    EQUIPMENT = "equipment"
    TOTAL = "total"


@dataclass
class LocationFactor:
    """Location adjustment factor."""
    location_code: str
    location_name: str
    country: str
    region: str
    labor_factor: float
    material_factor: float
    equipment_factor: float
    total_factor: float
    currency: str
    notes: str = ""


@dataclass
class AdjustedEstimate:
    """Estimate with location adjustment."""
    base_cost: float
    base_location: str
    target_location: str
    labor_adjustment: float
    material_adjustment: float
    equipment_adjustment: float
    total_adjustment: float
    adjusted_cost: float
    adjustment_percent: float


# Location factors (relative to US national average = 1.00)
LOCATION_FACTORS = {
    # USA
    'US-NYC': LocationFactor('US-NYC', 'New York City', 'USA', 'Northeast', 1.35, 1.15, 1.10, 1.22, 'USD'),
    'US-LA': LocationFactor('US-LA', 'Los Angeles', 'USA', 'West', 1.25, 1.10, 1.05, 1.15, 'USD'),
    'US-CHI': LocationFactor('US-CHI', 'Chicago', 'USA', 'Midwest', 1.20, 1.05, 1.05, 1.12, 'USD'),
    'US-HOU': LocationFactor('US-HOU', 'Houston', 'USA', 'South', 0.95, 0.98, 0.95, 0.96, 'USD'),
    'US-PHX': LocationFactor('US-PHX', 'Phoenix', 'USA', 'Southwest', 0.90, 0.95, 0.95, 0.93, 'USD'),
    'US-DEN': LocationFactor('US-DEN', 'Denver', 'USA', 'Mountain', 1.00, 1.02, 1.00, 1.01, 'USD'),
    'US-SEA': LocationFactor('US-SEA', 'Seattle', 'USA', 'Northwest', 1.18, 1.08, 1.05, 1.12, 'USD'),
    'US-MIA': LocationFactor('US-MIA', 'Miami', 'USA', 'Southeast', 0.98, 1.05, 1.00, 1.01, 'USD'),
    'US-ATL': LocationFactor('US-ATL', 'Atlanta', 'USA', 'Southeast', 0.92, 0.98, 0.95, 0.95, 'USD'),
    'US-NAT': LocationFactor('US-NAT', 'US National Average', 'USA', 'National', 1.00, 1.00, 1.00, 1.00, 'USD'),

    # Europe
    'UK-LON': LocationFactor('UK-LON', 'London', 'UK', 'Southeast', 1.45, 1.20, 1.15, 1.30, 'GBP'),
    'DE-BER': LocationFactor('DE-BER', 'Berlin', 'Germany', 'East', 1.15, 1.10, 1.10, 1.12, 'EUR'),
    'DE-MUN': LocationFactor('DE-MUN', 'Munich', 'Germany', 'South', 1.25, 1.15, 1.12, 1.18, 'EUR'),
    'FR-PAR': LocationFactor('FR-PAR', 'Paris', 'France', 'Ile-de-France', 1.30, 1.18, 1.15, 1.22, 'EUR'),
    'NL-AMS': LocationFactor('NL-AMS', 'Amsterdam', 'Netherlands', 'North Holland', 1.20, 1.12, 1.10, 1.15, 'EUR'),

    # Middle East
    'AE-DXB': LocationFactor('AE-DXB', 'Dubai', 'UAE', 'Dubai', 0.85, 1.25, 1.10, 1.05, 'AED'),
    'SA-RIY': LocationFactor('SA-RIY', 'Riyadh', 'Saudi Arabia', 'Central', 0.80, 1.20, 1.05, 1.00, 'SAR'),
    'QA-DOH': LocationFactor('QA-DOH', 'Doha', 'Qatar', 'Qatar', 0.88, 1.30, 1.12, 1.08, 'QAR'),

    # Asia
    'SG-SIN': LocationFactor('SG-SIN', 'Singapore', 'Singapore', 'Central', 1.10, 1.15, 1.08, 1.12, 'SGD'),
    'HK-HKG': LocationFactor('HK-HKG', 'Hong Kong', 'Hong Kong', 'Hong Kong', 1.20, 1.25, 1.15, 1.20, 'HKD'),
    'JP-TKY': LocationFactor('JP-TKY', 'Tokyo', 'Japan', 'Kanto', 1.35, 1.20, 1.18, 1.25, 'JPY'),

    # Australia
    'AU-SYD': LocationFactor('AU-SYD', 'Sydney', 'Australia', 'NSW', 1.25, 1.15, 1.12, 1.18, 'AUD'),
    'AU-MEL': LocationFactor('AU-MEL', 'Melbourne', 'Australia', 'Victoria', 1.20, 1.12, 1.10, 1.15, 'AUD'),
}


class CWICRLocationFactor:
    """Apply location factors to CWICR estimates."""

    def __init__(self,
                 cwicr_data: pd.DataFrame = None,
                 base_location: str = 'US-NAT'):
        self.cwicr = cwicr_data
        self.base_location = base_location
        self._factors = LOCATION_FACTORS.copy()

        if cwicr_data is not None:
            self._index_cwicr()

    def _index_cwicr(self):
        """Index CWICR data."""
        if 'work_item_code' in self.cwicr.columns:
            self._cwicr_index = self.cwicr.set_index('work_item_code')
        else:
            self._cwicr_index = None

    def get_factor(self, location_code: str) -> Optional[LocationFactor]:
        """Get location factor."""
        return self._factors.get(location_code)

    def list_locations(self, country: str = None) -> List[Dict[str, Any]]:
        """List available locations."""
        factors = self._factors.values()

        if country:
            factors = [f for f in factors if f.country.lower() == country.lower()]

        return [
            {
                'code': f.location_code,
                'name': f.location_name,
                'country': f.country,
                'region': f.region,
                'total_factor': f.total_factor,
                'currency': f.currency
            }
            for f in factors
        ]

    def add_location(self, factor: LocationFactor):
        """Add custom location factor."""
        self._factors[factor.location_code] = factor

    def adjust_cost(self,
                    base_cost: float,
                    target_location: str,
                    cost_breakdown: Dict[str, float] = None) -> AdjustedEstimate:
        """Adjust cost from base to target location."""

        base_factor = self._factors.get(self.base_location)
        target_factor = self._factors.get(target_location)

        if not base_factor or not target_factor:
            return AdjustedEstimate(
                base_cost=base_cost,
                base_location=self.base_location,
                target_location=target_location,
                labor_adjustment=0,
                material_adjustment=0,
                equipment_adjustment=0,
                total_adjustment=0,
                adjusted_cost=base_cost,
                adjustment_percent=0
            )

        if cost_breakdown is None:
            # Default breakdown
            cost_breakdown = {
                'labor': base_cost * 0.40,
                'material': base_cost * 0.45,
                'equipment': base_cost * 0.15
            }

        # Calculate relative factors
        labor_rel = target_factor.labor_factor / base_factor.labor_factor
        material_rel = target_factor.material_factor / base_factor.material_factor
        equipment_rel = target_factor.equipment_factor / base_factor.equipment_factor

        # Apply adjustments
        labor_adjusted = cost_breakdown.get('labor', 0) * labor_rel
        material_adjusted = cost_breakdown.get('material', 0) * material_rel
        equipment_adjusted = cost_breakdown.get('equipment', 0) * equipment_rel

        adjusted_total = labor_adjusted + material_adjusted + equipment_adjusted
        total_adjustment = adjusted_total - base_cost
        adjustment_pct = (total_adjustment / base_cost * 100) if base_cost > 0 else 0

        return AdjustedEstimate(
            base_cost=round(base_cost, 2),
            base_location=self.base_location,
            target_location=target_location,
            labor_adjustment=round(labor_adjusted - cost_breakdown.get('labor', 0), 2),
            material_adjustment=round(material_adjusted - cost_breakdown.get('material', 0), 2),
            equipment_adjustment=round(equipment_adjusted - cost_breakdown.get('equipment', 0), 2),
            total_adjustment=round(total_adjustment, 2),
            adjusted_cost=round(adjusted_total, 2),
            adjustment_percent=round(adjustment_pct, 1)
        )

    def adjust_estimate(self,
                         items: List[Dict[str, Any]],
                         target_location: str) -> Dict[str, Any]:
        """Adjust entire estimate for location."""

        adjusted_items = []
        total_base = 0
        total_adjusted = 0

        for item in items:
            code = item.get('work_item_code', item.get('code'))
            qty = item.get('quantity', 0)

            # Get costs from CWICR
            labor = 0
            material = 0
            equipment = 0

            if self._cwicr_index is not None and code in self._cwicr_index.index:
                wi = self._cwicr_index.loc[code]
                labor = float(wi.get('labor_cost', 0) or 0) * qty
                material = float(wi.get('material_cost', 0) or 0) * qty
                equipment = float(wi.get('equipment_cost', 0) or 0) * qty

            base_cost = labor + material + equipment
            breakdown = {'labor': labor, 'material': material, 'equipment': equipment}

            adjustment = self.adjust_cost(base_cost, target_location, breakdown)

            adjusted_items.append({
                'code': code,
                'quantity': qty,
                'base_cost': adjustment.base_cost,
                'adjusted_cost': adjustment.adjusted_cost,
                'adjustment': adjustment.total_adjustment
            })

            total_base += base_cost
            total_adjusted += adjustment.adjusted_cost

        return {
            'items': adjusted_items,
            'base_location': self.base_location,
            'target_location': target_location,
            'total_base': round(total_base, 2),
            'total_adjusted': round(total_adjusted, 2),
            'total_adjustment': round(total_adjusted - total_base, 2),
            'adjustment_percent': round((total_adjusted - total_base) / total_base * 100, 1) if total_base > 0 else 0
        }

    def compare_locations(self,
                           base_cost: float,
                           locations: List[str]) -> pd.DataFrame:
        """Compare cost across multiple locations."""

        data = []

        for loc_code in locations:
            adjustment = self.adjust_cost(base_cost, loc_code)
            factor = self._factors.get(loc_code)

            data.append({
                'Location': factor.location_name if factor else loc_code,
                'Code': loc_code,
                'Country': factor.country if factor else '',
                'Adjusted Cost': adjustment.adjusted_cost,
                'Adjustment %': adjustment.adjustment_percent,
                'Labor Factor': factor.labor_factor if factor else 1.0,
                'Material Factor': factor.material_factor if factor else 1.0
            })

        return pd.DataFrame(data).sort_values('Adjusted Cost')

    def normalize_to_base(self,
                           cost: float,
                           source_location: str) -> float:
        """Normalize cost from source location to base location."""

        source_factor = self._factors.get(source_location)
        base_factor = self._factors.get(self.base_location)

        if not source_factor or not base_factor:
            return cost

        relative_factor = base_factor.total_factor / source_factor.total_factor
        return round(cost * relative_factor, 2)

    def export_factors(self, output_path: str) -> str:
        """Export location factors to Excel."""

        with pd.ExcelWriter(output_path, engine='openpyxl') as writer:
            df = pd.DataFrame([
                {
                    'Code': f.location_code,
                    'Name': f.location_name,
                    'Country': f.country,
                    'Region': f.region,
                    'Labor Factor': f.labor_factor,
                    'Material Factor': f.material_factor,
                    'Equipment Factor': f.equipment_factor,
                    'Total Factor': f.total_factor,
                    'Currency': f.currency
                }
                for f in self._factors.values()
            ])
            df.to_excel(writer, sheet_name='Location Factors', index=False)

        return output_path
```

## Quick Start

```python
# Initialize with base location
loc_factor = CWICRLocationFactor(base_location='US-NAT')

# Adjust single cost
adjustment = loc_factor.adjust_cost(
    base_cost=1000000,
    target_location='US-NYC'
)

print(f"Base: ${adjustment.base_cost:,.2f}")
print(f"NYC: ${adjustment.adjusted_cost:,.2f}")
print(f"Adjustment: {adjustment.adjustment_percent:+.1f}%")
```

## Common Use Cases

### 1. Multi-Location Comparison
```python
comparison = loc_factor.compare_locations(
    base_cost=5000000,
    locations=['US-NYC', 'US-HOU', 'US-LA', 'UK-LON', 'AE-DXB']
)
print(comparison)
```

### 2. Adjust Estimate
```python
cwicr = pd.read_parquet("ddc_cwicr_en.parquet")
loc_factor = CWICRLocationFactor(cwicr, base_location='US-NAT')

items = [
    {'work_item_code': 'CONC-001', 'quantity': 200},
    {'work_item_code': 'STRL-002', 'quantity': 50}
]

dubai_estimate = loc_factor.adjust_estimate(items, 'AE-DXB')
print(f"Dubai Cost: ${dubai_estimate['total_adjusted']:,.2f}")
```

### 3. Custom Location
```python
loc_factor.add_location(LocationFactor(
    'US-REMOTE',
    'Remote Alaska',
    'USA',
    'Alaska',
    labor_factor=1.50,
    material_factor=1.40,
    equipment_factor=1.35,
    total_factor=1.42,
    currency='USD',
    notes='Remote location premium'
))
```

## Resources
- **GitHub**: [OpenConstructionEstimate-Jens-CWICR](https://github.com/jens-construction/OpenConstructionEstimate-Jens-CWICR)
- **Jens Book**: Chapter 3.1 - Location Cost Adjustments


---


# CWICR Material Procurement

## Business Case

### Problem Statement
Material procurement needs accurate quantity lists:
- What materials are needed?
- How much of each with waste allowance?
- When are they needed on site?
- How to group for suppliers?

### Solution
Generate procurement lists from CWICR material data with waste factors, delivery scheduling, and supplier grouping.

### Business Value
- **Accurate quantities** - Based on validated norms
- **Waste included** - Industry-standard waste factors
- **Timely delivery** - Aligned with schedule
- **Cost optimization** - Bulk ordering opportunities

## Technical Implementation

```python
import pandas as pd
import numpy as np
from typing import Dict, Any, List, Optional, Tuple
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum
from collections import defaultdict


class MaterialCategory(Enum):
    """Material categories for procurement."""
    CONCRETE = "concrete"
    STEEL = "steel"
    TIMBER = "timber"
    MASONRY = "masonry"
    FINISHES = "finishes"
    MEP = "mep"
    INSULATION = "insulation"
    ROOFING = "roofing"
    EARTHWORK = "earthwork"
    OTHER = "other"


class ProcurementPriority(Enum):
    """Procurement priority levels."""
    CRITICAL = 1
    HIGH = 2
    MEDIUM = 3
    LOW = 4


@dataclass
class MaterialItem:
    """Single material item for procurement."""
    material_code: str
    description: str
    category: MaterialCategory
    unit: str
    net_quantity: float
    waste_factor: float
    gross_quantity: float
    unit_price: float
    total_cost: float
    lead_time_days: int
    required_date: datetime
    order_date: datetime
    supplier: str = ""
    work_item_codes: List[str] = field(default_factory=list)


@dataclass
class ProcurementList:
    """Complete procurement list."""
    project_name: str
    generated_date: datetime
    total_items: int
    total_cost: float
    items: List[MaterialItem]
    by_category: Dict[str, float]
    by_supplier: Dict[str, List[MaterialItem]]


# Standard waste factors by material type
WASTE_FACTORS = {
    'concrete': 0.05,      # 5%
    'reinforcement': 0.03, # 3%
    'formwork': 0.10,      # 10%
    'masonry': 0.05,       # 5%
    'timber': 0.08,        # 8%
    'drywall': 0.10,       # 10%
    'tiles': 0.10,         # 10%
    'paint': 0.05,         # 5%
    'insulation': 0.05,    # 5%
    'pipes': 0.03,         # 3%
    'cables': 0.05,        # 5%
    'default': 0.05        # 5%
}

# Standard lead times by category (days)
LEAD_TIMES = {
    'concrete': 1,         # Ready-mix
    'reinforcement': 7,    # Steel delivery
    'formwork': 3,         # Standard forms
    'masonry': 5,          # Block delivery
    'timber': 5,           # Lumber
    'structural_steel': 21, # Fabrication
    'windows': 28,         # Manufacturing
    'doors': 14,           # Standard doors
    'mep': 14,             # MEP equipment
    'finishes': 7,         # Standard finishes
    'default': 7
}


class CWICRMaterialProcurement:
    """Generate procurement lists from CWICR data."""

    def __init__(self, cwicr_data: pd.DataFrame,
                 resources_data: pd.DataFrame = None):
        self.work_items = cwicr_data
        self.resources = resources_data
        self._index_data()

    def _index_data(self):
        """Index data for fast lookup."""
        if 'work_item_code' in self.work_items.columns:
            self._work_index = self.work_items.set_index('work_item_code')
        else:
            self._work_index = None

    def get_waste_factor(self, material_type: str) -> float:
        """Get waste factor for material type."""
        material_lower = str(material_type).lower()
        for key, factor in WASTE_FACTORS.items():
            if key in material_lower:
                return factor
        return WASTE_FACTORS['default']

    def get_lead_time(self, material_type: str) -> int:
        """Get lead time for material type."""
        material_lower = str(material_type).lower()
        for key, days in LEAD_TIMES.items():
            if key in material_lower:
                return days
        return LEAD_TIMES['default']

    def get_category(self, material_type: str) -> MaterialCategory:
        """Determine material category."""
        material_lower = str(material_type).lower()

        category_mapping = {
            'concrete': MaterialCategory.CONCRETE,
            'cement': MaterialCategory.CONCRETE,
            'steel': MaterialCategory.STEEL,
            'rebar': MaterialCategory.STEEL,
            'reinforcement': MaterialCategory.STEEL,
            'timber': MaterialCategory.TIMBER,
            'wood': MaterialCategory.TIMBER,
            'lumber': MaterialCategory.TIMBER,
            'masonry': MaterialCategory.MASONRY,
            'block': MaterialCategory.MASONRY,
            'brick': MaterialCategory.MASONRY,
            'paint': MaterialCategory.FINISHES,
            'tile': MaterialCategory.FINISHES,
            'floor': MaterialCategory.FINISHES,
            'electrical': MaterialCategory.MEP,
            'plumbing': MaterialCategory.MEP,
            'hvac': MaterialCategory.MEP,
            'insulation': MaterialCategory.INSULATION,
            'roof': MaterialCategory.ROOFING
        }

        for key, cat in category_mapping.items():
            if key in material_lower:
                return cat
        return MaterialCategory.OTHER

    def extract_materials(self,
                         items: List[Dict[str, Any]],
                         schedule: Dict[str, datetime] = None) -> List[MaterialItem]:
        """Extract material requirements from work items."""

        materials = defaultdict(lambda: {
            'net_quantity': 0,
            'work_items': [],
            'required_date': None
        })

        for item in items:
            code = item.get('work_item_code', item.get('code'))
            qty = item.get('quantity', 0)
            required_date = item.get('required_date')

            if self._work_index is not None and code in self._work_index.index:
                work_item = self._work_index.loc[code]

                # Get material info from work item
                material_desc = str(work_item.get('material_description',
                                                   work_item.get('description', '')))
                material_unit = str(work_item.get('material_unit',
                                                   work_item.get('unit', '')))
                material_norm = float(work_item.get('material_norm', 1) or 1)
                material_cost = float(work_item.get('material_cost', 0) or 0)

                # Calculate material quantity
                material_qty = qty * material_norm

                # Aggregate by material description
                mat_key = f"{material_desc}|{material_unit}"
                materials[mat_key]['net_quantity'] += material_qty
                materials[mat_key]['work_items'].append(code)
                materials[mat_key]['description'] = material_desc
                materials[mat_key]['unit'] = material_unit
                materials[mat_key]['unit_price'] = material_cost / material_norm if material_norm > 0 else 0

                if required_date:
                    if materials[mat_key]['required_date'] is None:
                        materials[mat_key]['required_date'] = required_date
                    else:
                        materials[mat_key]['required_date'] = min(
                            materials[mat_key]['required_date'], required_date
                        )

        # Convert to MaterialItem list
        result = []
        for mat_key, data in materials.items():
            description = data['description']
            waste_factor = self.get_waste_factor(description)
            lead_time = self.get_lead_time(description)
            net_qty = data['net_quantity']
            gross_qty = net_qty * (1 + waste_factor)
            unit_price = data.get('unit_price', 0)

            required_date = data['required_date'] or datetime.now() + timedelta(days=30)
            order_date = required_date - timedelta(days=lead_time)

            result.append(MaterialItem(
                material_code=mat_key.split('|')[0][:20],
                description=description,
                category=self.get_category(description),
                unit=data['unit'],
                net_quantity=round(net_qty, 2),
                waste_factor=waste_factor,
                gross_quantity=round(gross_qty, 2),
                unit_price=round(unit_price, 2),
                total_cost=round(gross_qty * unit_price, 2),
                lead_time_days=lead_time,
                required_date=required_date,
                order_date=order_date,
                work_item_codes=data['work_items']
            ))

        return result

    def generate_procurement_list(self,
                                  items: List[Dict[str, Any]],
                                  project_name: str = "Project") -> ProcurementList:
        """Generate complete procurement list."""

        materials = self.extract_materials(items)

        # Group by category
        by_category = defaultdict(float)
        for mat in materials:
            by_category[mat.category.value] += mat.total_cost

        # Group by supplier (placeholder - would use supplier mapping)
        by_supplier = defaultdict(list)
        for mat in materials:
            supplier = self._suggest_supplier(mat)
            mat.supplier = supplier
            by_supplier[supplier].append(mat)

        return ProcurementList(
            project_name=project_name,
            generated_date=datetime.now(),
            total_items=len(materials),
            total_cost=sum(m.total_cost for m in materials),
            items=materials,
            by_category=dict(by_category),
            by_supplier=dict(by_supplier)
        )

    def _suggest_supplier(self, material: MaterialItem) -> str:
        """Suggest supplier based on material category."""
        supplier_mapping = {
            MaterialCategory.CONCRETE: "Ready-Mix Supplier",
            MaterialCategory.STEEL: "Steel Fabricator",
            MaterialCategory.TIMBER: "Lumber Yard",
            MaterialCategory.MASONRY: "Masonry Supplier",
            MaterialCategory.MEP: "MEP Distributor",
            MaterialCategory.FINISHES: "Building Materials",
            MaterialCategory.INSULATION: "Insulation Supplier",
            MaterialCategory.ROOFING: "Roofing Supplier"
        }
        return supplier_mapping.get(material.category, "General Supplier")

    def create_purchase_order(self,
                              materials: List[MaterialItem],
                              supplier: str,
                              po_number: str) -> Dict[str, Any]:
        """Create purchase order for supplier."""

        po_items = [m for m in materials if m.supplier == supplier]

        return {
            'po_number': po_number,
            'supplier': supplier,
            'date': datetime.now().isoformat(),
            'delivery_date': min(m.required_date for m in po_items).isoformat() if po_items else None,
            'items': [
                {
                    'description': m.description,
                    'quantity': m.gross_quantity,
                    'unit': m.unit,
                    'unit_price': m.unit_price,
                    'total': m.total_cost
                }
                for m in po_items
            ],
            'subtotal': sum(m.total_cost for m in po_items),
            'item_count': len(po_items)
        }

    def export_to_excel(self,
                       procurement_list: ProcurementList,
                       output_path: str) -> str:
        """Export procurement list to Excel."""

        with pd.ExcelWriter(output_path, engine='openpyxl') as writer:
            # All materials
            items_df = pd.DataFrame([
                {
                    'Description': m.description,
                    'Category': m.category.value,
                    'Unit': m.unit,
                    'Net Qty': m.net_quantity,
                    'Waste %': m.waste_factor * 100,
                    'Gross Qty': m.gross_quantity,
                    'Unit Price': m.unit_price,
                    'Total Cost': m.total_cost,
                    'Lead Time': m.lead_time_days,
                    'Order By': m.order_date.strftime('%Y-%m-%d'),
                    'Required': m.required_date.strftime('%Y-%m-%d'),
                    'Supplier': m.supplier
                }
                for m in procurement_list.items
            ])
            items_df.to_excel(writer, sheet_name='Materials', index=False)

            # By category
            cat_df = pd.DataFrame([
                {'Category': cat, 'Total Cost': cost}
                for cat, cost in procurement_list.by_category.items()
            ])
            cat_df.to_excel(writer, sheet_name='By Category', index=False)

            # Summary
            summary_df = pd.DataFrame([{
                'Project': procurement_list.project_name,
                'Generated': procurement_list.generated_date.strftime('%Y-%m-%d'),
                'Total Items': procurement_list.total_items,
                'Total Cost': procurement_list.total_cost
            }])
            summary_df.to_excel(writer, sheet_name='Summary', index=False)

        return output_path

    def get_critical_orders(self,
                           procurement_list: ProcurementList,
                           days_ahead: int = 14) -> List[MaterialItem]:
        """Get materials that need to be ordered soon."""

        cutoff = datetime.now() + timedelta(days=days_ahead)
        return [
            m for m in procurement_list.items
            if m.order_date <= cutoff
        ]

    def aggregate_by_material(self,
                              items: List[Dict[str, Any]]) -> pd.DataFrame:
        """Aggregate materials across multiple work items."""

        materials = self.extract_materials(items)

        df = pd.DataFrame([
            {
                'Material': m.description,
                'Category': m.category.value,
                'Total Qty': m.gross_quantity,
                'Unit': m.unit,
                'Total Cost': m.total_cost,
                'Work Items': len(m.work_item_codes)
            }
            for m in materials
        ])

        return df.sort_values('Total Cost', ascending=False)
```

## Quick Start

```python
# Load CWICR data
cwicr = pd.read_parquet("ddc_cwicr_en.parquet")

# Initialize procurement generator
procurement = CWICRMaterialProcurement(cwicr)

# Define work items
items = [
    {'work_item_code': 'CONC-001', 'quantity': 150},
    {'work_item_code': 'REBAR-002', 'quantity': 5000},
    {'work_item_code': 'FORM-003', 'quantity': 300}
]

# Generate procurement list
proc_list = procurement.generate_procurement_list(items, "Building A")

print(f"Total Items: {proc_list.total_items}")
print(f"Total Cost: ${proc_list.total_cost:,.2f}")
```

## Common Use Cases

### 1. Get Critical Orders
```python
critical = procurement.get_critical_orders(proc_list, days_ahead=7)
print(f"Order immediately: {len(critical)} items")
```

### 2. Create Purchase Order
```python
po = procurement.create_purchase_order(
    proc_list.items,
    supplier="Steel Fabricator",
    po_number="PO-2024-001"
)
```

### 3. Export to Excel
```python
procurement.export_to_excel(proc_list, "procurement_list.xlsx")
```

### 4. Material Aggregation
```python
materials_df = procurement.aggregate_by_material(items)
print(materials_df.head(10))
```

## Resources
- **GitHub**: [OpenConstructionEstimate-Jens-CWICR](https://github.com/jens-construction/OpenConstructionEstimate-Jens-CWICR)
- **Jens Book**: Chapter 3.1 - Material Resource Planning


---


# CWICR Material Substitution

## Business Case

### Problem Statement
Material substitution challenges:
- Supply chain issues
- Cost optimization
- Specification compliance
- Equivalent performance

### Solution
Systematic material substitution using CWICR data to find functionally equivalent alternatives with cost and performance analysis.

### Business Value
- **Supply flexibility** - Alternative sources
- **Cost savings** - Lower-cost equivalents
- **Compliance** - Specification matching
- **Quick decisions** - Rapid alternative search

## Technical Implementation

```python
import pandas as pd
import numpy as np
from typing import Dict, Any, List, Optional, Tuple
from dataclasses import dataclass
from enum import Enum
from difflib import SequenceMatcher


class SubstitutionType(Enum):
    """Types of substitution."""
    DIRECT = "direct"        # Drop-in replacement
    EQUIVALENT = "equivalent"  # Same function, different material
    UPGRADE = "upgrade"      # Better performance
    DOWNGRADE = "downgrade"  # Lower performance (cost saving)


class CompatibilityLevel(Enum):
    """Compatibility levels."""
    EXACT = "exact"          # Identical specs
    HIGH = "high"            # Minor differences
    MEDIUM = "medium"        # Requires review
    LOW = "low"              # Significant differences


@dataclass
class MaterialSubstitute:
    """Material substitution option."""
    original_code: str
    original_description: str
    substitute_code: str
    substitute_description: str
    substitution_type: SubstitutionType
    compatibility: CompatibilityLevel
    original_cost: float
    substitute_cost: float
    cost_difference: float
    cost_difference_pct: float
    notes: str


# Material compatibility groups
MATERIAL_GROUPS = {
    'concrete': ['cement', 'beton', 'concrete', 'C20', 'C25', 'C30', 'C35', 'C40'],
    'steel': ['steel', 'rebar', 'reinforcement', 'S235', 'S275', 'S355'],
    'lumber': ['wood', 'timber', 'lumber', 'plywood', 'OSB'],
    'masonry': ['brick', 'block', 'CMU', 'masonry'],
    'insulation': ['insulation', 'rockwool', 'glasswool', 'EPS', 'XPS', 'PIR'],
    'pipe': ['pipe', 'PVC', 'HDPE', 'copper', 'steel pipe'],
    'electrical': ['wire', 'cable', 'conduit'],
    'finishing': ['paint', 'plaster', 'drywall', 'gypsum'],
    'flooring': ['tile', 'vinyl', 'laminate', 'carpet', 'hardwood'],
    'roofing': ['shingle', 'membrane', 'metal roof', 'tile roof']
}


class CWICRMaterialSubstitution:
    """Find material substitutions using CWICR data."""

    def __init__(self, cwicr_data: pd.DataFrame):
        self.materials = cwicr_data
        self._index_data()

    def _index_data(self):
        """Index material data."""
        if 'work_item_code' in self.materials.columns:
            self._code_index = self.materials.set_index('work_item_code')
        elif 'material_code' in self.materials.columns:
            self._code_index = self.materials.set_index('material_code')
        else:
            self._code_index = None

    def _similarity(self, a: str, b: str) -> float:
        """Calculate string similarity."""
        return SequenceMatcher(None, a.lower(), b.lower()).ratio()

    def _get_material_group(self, description: str) -> Optional[str]:
        """Identify material group from description."""
        desc_lower = description.lower()

        for group, keywords in MATERIAL_GROUPS.items():
            if any(kw.lower() in desc_lower for kw in keywords):
                return group

        return None

    def _get_cost(self, code: str) -> Tuple[float, str]:
        """Get material cost."""
        if self._code_index is None or code not in self._code_index.index:
            return (0, 'unit')

        item = self._code_index.loc[code]
        cost = float(item.get('material_cost', item.get('total_cost', 0)) or 0)
        unit = str(item.get('unit', 'unit'))

        return (cost, unit)

    def find_substitutes(self,
                          material_code: str,
                          max_results: int = 10,
                          max_cost_increase: float = 0.20,
                          include_upgrades: bool = True) -> List[MaterialSubstitute]:
        """Find substitute materials."""

        if self._code_index is None or material_code not in self._code_index.index:
            return []

        original = self._code_index.loc[material_code]
        original_desc = str(original.get('description', material_code))
        original_cost, original_unit = self._get_cost(material_code)

        group = self._get_material_group(original_desc)

        substitutes = []

        for code, row in self._code_index.iterrows():
            if code == material_code:
                continue

            sub_desc = str(row.get('description', code))
            sub_group = self._get_material_group(sub_desc)

            # Check if same group or similar description
            if group and sub_group == group:
                similarity = 0.7
            else:
                similarity = self._similarity(original_desc, sub_desc)

            if similarity < 0.3:
                continue

            sub_cost, sub_unit = self._get_cost(code)

            if sub_unit != original_unit:
                continue

            cost_diff = sub_cost - original_cost
            cost_diff_pct = (cost_diff / original_cost * 100) if original_cost > 0 else 0

            # Filter by cost increase limit
            if not include_upgrades and cost_diff_pct > max_cost_increase * 100:
                continue

            # Determine substitution type
            if cost_diff_pct < -10:
                sub_type = SubstitutionType.DOWNGRADE
            elif cost_diff_pct > 10:
                sub_type = SubstitutionType.UPGRADE
            elif similarity > 0.8:
                sub_type = SubstitutionType.DIRECT
            else:
                sub_type = SubstitutionType.EQUIVALENT

            # Determine compatibility
            if similarity > 0.9:
                compat = CompatibilityLevel.EXACT
            elif similarity > 0.7:
                compat = CompatibilityLevel.HIGH
            elif similarity > 0.5:
                compat = CompatibilityLevel.MEDIUM
            else:
                compat = CompatibilityLevel.LOW

            substitutes.append(MaterialSubstitute(
                original_code=material_code,
                original_description=original_desc,
                substitute_code=code,
                substitute_description=sub_desc,
                substitution_type=sub_type,
                compatibility=compat,
                original_cost=round(original_cost, 2),
                substitute_cost=round(sub_cost, 2),
                cost_difference=round(cost_diff, 2),
                cost_difference_pct=round(cost_diff_pct, 1),
                notes=f"Similarity: {similarity:.0%}"
            ))

        # Sort by compatibility then cost
        substitutes.sort(key=lambda x: (
            list(CompatibilityLevel).index(x.compatibility),
            x.cost_difference
        ))

        return substitutes[:max_results]

    def find_cost_saving_alternatives(self,
                                       material_code: str,
                                       min_savings_pct: float = 5.0) -> List[MaterialSubstitute]:
        """Find lower-cost alternatives."""

        subs = self.find_substitutes(material_code, max_results=20)

        cost_saving = [
            s for s in subs
            if s.cost_difference_pct <= -min_savings_pct
        ]

        return sorted(cost_saving, key=lambda x: x.cost_difference)

    def find_by_group(self,
                       group_name: str,
                       max_results: int = 20) -> List[Dict[str, Any]]:
        """Find all materials in a group."""

        if self._code_index is None:
            return []

        results = []

        for code, row in self._code_index.iterrows():
            desc = str(row.get('description', code))
            item_group = self._get_material_group(desc)

            if item_group == group_name.lower():
                cost, unit = self._get_cost(code)
                results.append({
                    'code': code,
                    'description': desc,
                    'cost': cost,
                    'unit': unit,
                    'group': item_group
                })

        return sorted(results, key=lambda x: x['cost'])[:max_results]

    def substitution_impact(self,
                            original_code: str,
                            substitute_code: str,
                            quantity: float) -> Dict[str, Any]:
        """Calculate impact of substitution."""

        original_cost, _ = self._get_cost(original_code)
        substitute_cost, _ = self._get_cost(substitute_code)

        original_total = original_cost * quantity
        substitute_total = substitute_cost * quantity
        impact = substitute_total - original_total

        return {
            'original_code': original_code,
            'substitute_code': substitute_code,
            'quantity': quantity,
            'original_unit_cost': original_cost,
            'substitute_unit_cost': substitute_cost,
            'original_total': round(original_total, 2),
            'substitute_total': round(substitute_total, 2),
            'cost_impact': round(impact, 2),
            'impact_percent': round(impact / original_total * 100, 1) if original_total > 0 else 0
        }

    def batch_substitution(self,
                            materials: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Find substitutions for multiple materials."""

        results = []
        total_original = 0
        total_potential_savings = 0

        for mat in materials:
            code = mat.get('material_code', mat.get('code'))
            qty = mat.get('quantity', 1)

            subs = self.find_cost_saving_alternatives(code)

            original_cost, _ = self._get_cost(code)
            original_total = original_cost * qty
            total_original += original_total

            best_sub = subs[0] if subs else None
            potential_savings = 0

            if best_sub:
                impact = self.substitution_impact(code, best_sub.substitute_code, qty)
                potential_savings = abs(impact['cost_impact']) if impact['cost_impact'] < 0 else 0
                total_potential_savings += potential_savings

            results.append({
                'code': code,
                'quantity': qty,
                'original_total': round(original_total, 2),
                'best_substitute': best_sub.substitute_code if best_sub else None,
                'potential_savings': round(potential_savings, 2),
                'alternatives_count': len(subs)
            })

        return {
            'materials': results,
            'total_original_cost': round(total_original, 2),
            'total_potential_savings': round(total_potential_savings, 2),
            'savings_percent': round(total_potential_savings / total_original * 100, 1) if total_original > 0 else 0
        }

    def export_substitution_report(self,
                                    substitutes: List[MaterialSubstitute],
                                    output_path: str) -> str:
        """Export substitution report to Excel."""

        with pd.ExcelWriter(output_path, engine='openpyxl') as writer:
            df = pd.DataFrame([
                {
                    'Original Code': s.original_code,
                    'Original Description': s.original_description,
                    'Substitute Code': s.substitute_code,
                    'Substitute Description': s.substitute_description,
                    'Type': s.substitution_type.value,
                    'Compatibility': s.compatibility.value,
                    'Original Cost': s.original_cost,
                    'Substitute Cost': s.substitute_cost,
                    'Cost Difference': s.cost_difference,
                    'Difference %': s.cost_difference_pct,
                    'Notes': s.notes
                }
                for s in substitutes
            ])
            df.to_excel(writer, sheet_name='Substitutes', index=False)

        return output_path
```

## Quick Start

```python
# Load CWICR data
cwicr = pd.read_parquet("ddc_cwicr_en.parquet")

# Initialize substitution finder
sub_finder = CWICRMaterialSubstitution(cwicr)

# Find substitutes
substitutes = sub_finder.find_substitutes("CONC-C30-001")

for sub in substitutes[:5]:
    print(f"{sub.substitute_code}: ${sub.cost_difference:+.2f} ({sub.cost_difference_pct:+.1f}%)")
```

## Common Use Cases

### 1. Cost Saving Alternatives
```python
savings = sub_finder.find_cost_saving_alternatives("STEEL-S355", min_savings_pct=10)
for s in savings:
    print(f"{s.substitute_code}: Save ${abs(s.cost_difference):.2f}/unit")
```

### 2. Batch Analysis
```python
materials = [
    {'code': 'CONC-001', 'quantity': 200},
    {'code': 'STEEL-002', 'quantity': 5000},
    {'code': 'BRICK-003', 'quantity': 10000}
]

batch = sub_finder.batch_substitution(materials)
print(f"Potential Savings: ${batch['total_potential_savings']:,.2f}")
```

### 3. Material Group Search
```python
concrete_options = sub_finder.find_by_group('concrete')
for opt in concrete_options[:5]:
    print(f"{opt['code']}: ${opt['cost']:.2f}/{opt['unit']}")
```

## Resources
- **GitHub**: [OpenConstructionEstimate-Jens-CWICR](https://github.com/jens-construction/OpenConstructionEstimate-Jens-CWICR)
- **Jens Book**: Chapter 3.1 - Material Management


---


# CWICR Multilingual Support

## Overview
CWICR database supports 9 languages with consistent work item codes. This skill enables cross-language work item matching, translation, and regional price comparison.

## Supported Languages

| Code | Language | Region | Currency |
|------|----------|--------|----------|
| AR | Arabic | Dubai | AED |
| DE | German | Berlin | EUR |
| EN | English | Toronto | CAD |
| ES | Spanish | Barcelona | EUR |
| FR | French | Paris | EUR |
| HI | Hindi | Mumbai | INR |
| PT | Portuguese | São Paulo | BRL |
| RU | Russian | St. Petersburg | RUB |
| ZH | Chinese | Shanghai | CNY |

## Python Implementation

```python
import pandas as pd
from typing import Dict, Any, List, Optional, Tuple
from dataclasses import dataclass
from enum import Enum


class CWICRLanguage(Enum):
    """Supported CWICR languages."""
    ARABIC = ("ar", "Arabic", "AED", "Dubai")
    GERMAN = ("de", "German", "EUR", "Berlin")
    ENGLISH = ("en", "English", "CAD", "Toronto")
    SPANISH = ("es", "Spanish", "EUR", "Barcelona")
    FRENCH = ("fr", "French", "EUR", "Paris")
    HINDI = ("hi", "Hindi", "INR", "Mumbai")
    PORTUGUESE = ("pt", "Portuguese", "BRL", "São Paulo")
    RUSSIAN = ("ru", "Russian", "RUB", "St. Petersburg")
    CHINESE = ("zh", "Chinese", "CNY", "Shanghai")

    @property
    def code(self) -> str:
        return self.value[0]

    @property
    def name(self) -> str:
        return self.value[1]

    @property
    def currency(self) -> str:
        return self.value[2]

    @property
    def region(self) -> str:
        return self.value[3]


@dataclass
class MultilingualWorkItem:
    """Work item with translations."""
    work_item_code: str
    translations: Dict[str, str]  # language_code -> description
    prices: Dict[str, float]      # language_code -> unit_price
    unit: str


class CWICRMultilingual:
    """Work with CWICR across languages."""

    # Exchange rates to USD (approximate)
    EXCHANGE_RATES = {
        'AED': 0.27,
        'EUR': 1.08,
        'CAD': 0.74,
        'INR': 0.012,
        'BRL': 0.20,
        'RUB': 0.011,
        'CNY': 0.14,
        'USD': 1.0
    }

    def __init__(self, databases: Dict[str, pd.DataFrame] = None):
        """Initialize with language databases."""
        self.databases = databases or {}
        self._index_databases()

    def _index_databases(self):
        """Create code-based index for each database."""
        self.indexes = {}
        for lang, df in self.databases.items():
            if 'work_item_code' in df.columns:
                self.indexes[lang] = df.set_index('work_item_code')

    def load_database(self, language: CWICRLanguage,
                      file_path: str):
        """Load database for specific language."""
        # Detect format and load
        if file_path.endswith('.parquet'):
            df = pd.read_parquet(file_path)
        elif file_path.endswith('.xlsx'):
            df = pd.read_excel(file_path)
        elif file_path.endswith('.csv'):
            df = pd.read_csv(file_path)
        else:
            raise ValueError(f"Unsupported format: {file_path}")

        self.databases[language.code] = df
        if 'work_item_code' in df.columns:
            self.indexes[language.code] = df.set_index('work_item_code')

    def get_item_translations(self, work_item_code: str) -> MultilingualWorkItem:
        """Get all translations for a work item."""

        translations = {}
        prices = {}
        unit = ""

        for lang, index in self.indexes.items():
            if work_item_code in index.index:
                row = index.loc[work_item_code]
                translations[lang] = str(row.get('description', ''))
                prices[lang] = float(row.get('unit_price', 0))
                if not unit:
                    unit = str(row.get('unit', ''))

        return MultilingualWorkItem(
            work_item_code=work_item_code,
            translations=translations,
            prices=prices,
            unit=unit
        )

    def translate(self, work_item_code: str,
                  from_lang: str,
                  to_lang: str) -> Optional[str]:
        """Translate work item description."""

        if to_lang not in self.indexes:
            return None

        if work_item_code in self.indexes[to_lang].index:
            return str(self.indexes[to_lang].loc[work_item_code].get('description', ''))

        return None

    def compare_prices(self, work_item_code: str,
                       normalize_to_usd: bool = True) -> Dict[str, float]:
        """Compare prices across regions."""

        prices = {}

        for lang, index in self.indexes.items():
            if work_item_code in index.index:
                price = float(index.loc[work_item_code].get('unit_price', 0))

                if normalize_to_usd:
                    # Get currency for this language
                    currency = self._get_currency(lang)
                    rate = self.EXCHANGE_RATES.get(currency, 1.0)
                    price = price * rate

                prices[lang] = round(price, 2)

        return prices

    def _get_currency(self, lang_code: str) -> str:
        """Get currency for language code."""
        for lang in CWICRLanguage:
            if lang.code == lang_code:
                return lang.currency
        return 'USD'

    def find_cheapest_region(self, work_item_code: str) -> Tuple[str, float]:
        """Find region with lowest price (USD normalized)."""

        prices = self.compare_prices(work_item_code, normalize_to_usd=True)

        if not prices:
            return ('', 0)

        cheapest = min(prices.items(), key=lambda x: x[1])
        return cheapest

    def find_most_expensive_region(self, work_item_code: str) -> Tuple[str, float]:
        """Find region with highest price (USD normalized)."""

        prices = self.compare_prices(work_item_code, normalize_to_usd=True)

        if not prices:
            return ('', 0)

        expensive = max(prices.items(), key=lambda x: x[1])
        return expensive

    def cross_language_search(self, query: str,
                              source_lang: str) -> Dict[str, List[str]]:
        """Search in one language, get results in all languages."""

        if source_lang not in self.databases:
            return {}

        source_df = self.databases[source_lang]

        # Find matching codes
        matches = source_df[
            source_df['description'].str.contains(query, case=False, na=False)
        ]['work_item_code'].tolist()

        # Get translations for matches
        results = {}
        for code in matches[:10]:  # Limit to 10
            item = self.get_item_translations(code)
            results[code] = item.translations

        return results

    def price_comparison_report(self, work_item_codes: List[str]) -> pd.DataFrame:
        """Generate price comparison report across regions."""

        rows = []
        for code in work_item_codes:
            item = self.get_item_translations(code)
            prices_usd = self.compare_prices(code, normalize_to_usd=True)

            row = {
                'code': code,
                'description': item.translations.get('en', list(item.translations.values())[0] if item.translations else ''),
                'unit': item.unit
            }

            for lang, price in prices_usd.items():
                row[f'price_{lang}_usd'] = price

            if prices_usd:
                row['min_price'] = min(prices_usd.values())
                row['max_price'] = max(prices_usd.values())
                row['price_variance'] = row['max_price'] - row['min_price']

            rows.append(row)

        return pd.DataFrame(rows)


class LanguageDetector:
    """Detect language of construction text."""

    # Common construction terms by language
    KEYWORDS = {
        'en': ['concrete', 'wall', 'floor', 'door', 'window', 'steel', 'brick'],
        'de': ['beton', 'wand', 'boden', 'tür', 'fenster', 'stahl', 'ziegel'],
        'es': ['hormigón', 'pared', 'piso', 'puerta', 'ventana', 'acero', 'ladrillo'],
        'fr': ['béton', 'mur', 'plancher', 'porte', 'fenêtre', 'acier', 'brique'],
        'ru': ['бетон', 'стена', 'пол', 'дверь', 'окно', 'сталь', 'кирпич'],
        'zh': ['混凝土', '墙', '地板', '门', '窗', '钢', '砖'],
        'pt': ['concreto', 'parede', 'piso', 'porta', 'janela', 'aço', 'tijolo'],
        'ar': ['خرسانة', 'جدار', 'أرضية', 'باب', 'نافذة', 'فولاذ', 'طوب'],
        'hi': ['कंक्रीट', 'दीवार', 'फर्श', 'दरवाजा', 'खिड़की', 'इस्पात', 'ईंट']
    }

    @staticmethod
    def detect(text: str) -> str:
        """Detect language of text."""
        text_lower = text.lower()

        scores = {}
        for lang, keywords in LanguageDetector.KEYWORDS.items():
            score = sum(1 for kw in keywords if kw in text_lower)
            if score > 0:
                scores[lang] = score

        if scores:
            return max(scores.items(), key=lambda x: x[1])[0]

        return 'en'  # Default to English
```

## Quick Start

```python
# Initialize multilingual support
multi = CWICRMultilingual()

# Load databases
multi.load_database(CWICRLanguage.ENGLISH, "cwicr_en.parquet")
multi.load_database(CWICRLanguage.GERMAN, "cwicr_de.parquet")
multi.load_database(CWICRLanguage.SPANISH, "cwicr_es.parquet")

# Get translations
item = multi.get_item_translations("CONC-001")
print(f"EN: {item.translations.get('en')}")
print(f"DE: {item.translations.get('de')}")
```

## Price Comparison

```python
# Compare concrete prices across regions
prices = multi.compare_prices("CONC-001", normalize_to_usd=True)
print(prices)

# Find cheapest region
region, price = multi.find_cheapest_region("CONC-001")
print(f"Cheapest: {region} at ${price}")
```

## Resources
- **Jens Book**: Chapter 2.2 - Open Data Integration
- **CWICR Database**: 9 languages, 55,000+ items


---


# CWICR Overhead & Markup Calculator

## Business Case

### Problem Statement
Direct costs need additional markups:
- General overhead (office, insurance)
- Project overhead (site costs)
- Profit margins
- Bonds and insurance

### Solution
Systematic markup application to CWICR direct costs with configurable rates for overhead, profit, bonds, and other indirect costs.

### Business Value
- **Complete pricing** - From cost to selling price
- **Configurable rates** - By project/client type
- **Transparency** - Clear markup breakdown
- **Consistency** - Standard markup application

## Technical Implementation

```python
import pandas as pd
from typing import Dict, Any, List, Optional
from dataclasses import dataclass, field
from enum import Enum


class MarkupType(Enum):
    """Types of markup."""
    OVERHEAD = "overhead"
    PROFIT = "profit"
    BOND = "bond"
    INSURANCE = "insurance"
    CONTINGENCY = "contingency"
    TAX = "tax"
    ESCALATION = "escalation"
    CUSTOM = "custom"


class MarkupMethod(Enum):
    """Markup calculation methods."""
    ON_COST = "on_cost"              # Markup on direct cost
    ON_COST_PLUS = "on_cost_plus"    # Markup on cost + previous markups
    FIXED = "fixed"                   # Fixed amount


@dataclass
class MarkupItem:
    """Single markup item."""
    name: str
    markup_type: MarkupType
    rate: float
    method: MarkupMethod
    base_amount: float
    markup_amount: float


@dataclass
class MarkupSchedule:
    """Complete markup schedule."""
    name: str
    markups: List[MarkupItem]

    def get_total_rate(self) -> float:
        """Get combined markup rate."""
        return sum(m.rate for m in self.markups)


@dataclass
class PricingResult:
    """Complete pricing with all markups."""
    direct_cost: float
    labor_cost: float
    material_cost: float
    equipment_cost: float
    subcontractor_cost: float
    markups: List[MarkupItem]
    total_markup: float
    total_price: float
    markup_percentage: float


# Standard markup templates
MARKUP_TEMPLATES = {
    'residential': {
        'overhead': 0.10,
        'profit': 0.10,
        'contingency': 0.05
    },
    'commercial': {
        'overhead': 0.12,
        'profit': 0.08,
        'bond': 0.015,
        'insurance': 0.02,
        'contingency': 0.05
    },
    'industrial': {
        'overhead': 0.15,
        'profit': 0.08,
        'bond': 0.02,
        'insurance': 0.025,
        'contingency': 0.08
    },
    'government': {
        'overhead': 0.12,
        'profit': 0.06,
        'bond': 0.025,
        'contingency': 0.05
    },
    'subcontractor': {
        'overhead': 0.08,
        'profit': 0.10
    }
}


class CWICROverheadMarkup:
    """Apply overhead and markup to CWICR estimates."""

    def __init__(self, cwicr_data: pd.DataFrame = None):
        self.cost_data = cwicr_data
        if cwicr_data is not None:
            self._index_data()

    def _index_data(self):
        """Index cost data."""
        if 'work_item_code' in self.cost_data.columns:
            self._code_index = self.cost_data.set_index('work_item_code')
        else:
            self._code_index = None

    def get_template(self, template_name: str) -> Dict[str, float]:
        """Get markup template."""
        return MARKUP_TEMPLATES.get(template_name, MARKUP_TEMPLATES['commercial'])

    def create_markup_schedule(self,
                                name: str,
                                markups: Dict[str, float],
                                method: MarkupMethod = MarkupMethod.ON_COST) -> MarkupSchedule:
        """Create markup schedule from rates."""

        items = []
        for markup_name, rate in markups.items():
            markup_type = MarkupType.CUSTOM
            for mt in MarkupType:
                if mt.value in markup_name.lower():
                    markup_type = mt
                    break

            items.append(MarkupItem(
                name=markup_name,
                markup_type=markup_type,
                rate=rate,
                method=method,
                base_amount=0,
                markup_amount=0
            ))

        return MarkupSchedule(name=name, markups=items)

    def apply_markups(self,
                      direct_cost: float,
                      schedule: MarkupSchedule,
                      cost_breakdown: Dict[str, float] = None) -> PricingResult:
        """Apply markup schedule to direct cost."""

        if cost_breakdown is None:
            cost_breakdown = {
                'labor': direct_cost * 0.40,
                'material': direct_cost * 0.45,
                'equipment': direct_cost * 0.10,
                'subcontractor': direct_cost * 0.05
            }

        markup_items = []
        running_total = direct_cost

        for markup in schedule.markups:
            if markup.method == MarkupMethod.ON_COST:
                base = direct_cost
            elif markup.method == MarkupMethod.ON_COST_PLUS:
                base = running_total
            else:  # FIXED
                base = 1

            amount = base * markup.rate

            markup_items.append(MarkupItem(
                name=markup.name,
                markup_type=markup.markup_type,
                rate=markup.rate,
                method=markup.method,
                base_amount=round(base, 2),
                markup_amount=round(amount, 2)
            ))

            running_total += amount

        total_markup = running_total - direct_cost
        markup_pct = (total_markup / direct_cost * 100) if direct_cost > 0 else 0

        return PricingResult(
            direct_cost=round(direct_cost, 2),
            labor_cost=round(cost_breakdown.get('labor', 0), 2),
            material_cost=round(cost_breakdown.get('material', 0), 2),
            equipment_cost=round(cost_breakdown.get('equipment', 0), 2),
            subcontractor_cost=round(cost_breakdown.get('subcontractor', 0), 2),
            markups=markup_items,
            total_markup=round(total_markup, 2),
            total_price=round(running_total, 2),
            markup_percentage=round(markup_pct, 1)
        )

    def price_estimate(self,
                       items: List[Dict[str, Any]],
                       template: str = 'commercial') -> PricingResult:
        """Price complete estimate with markups."""

        # Calculate direct costs
        labor = 0
        material = 0
        equipment = 0
        subcontractor = 0

        for item in items:
            code = item.get('work_item_code', item.get('code'))
            qty = item.get('quantity', 0)

            if self._code_index is not None and code in self._code_index.index:
                wi = self._code_index.loc[code]
                labor += float(wi.get('labor_cost', 0) or 0) * qty
                material += float(wi.get('material_cost', 0) or 0) * qty
                equipment += float(wi.get('equipment_cost', 0) or 0) * qty

            subcontractor += item.get('subcontractor_cost', 0)

        direct_cost = labor + material + equipment + subcontractor
        cost_breakdown = {
            'labor': labor,
            'material': material,
            'equipment': equipment,
            'subcontractor': subcontractor
        }

        # Get template and create schedule
        rates = self.get_template(template)
        schedule = self.create_markup_schedule(template, rates)

        return self.apply_markups(direct_cost, schedule, cost_breakdown)

    def calculate_bid_price(self,
                            direct_cost: float,
                            overhead_rate: float = 0.12,
                            profit_rate: float = 0.08,
                            bond_rate: float = 0.015,
                            contingency_rate: float = 0.05) -> Dict[str, Any]:
        """Calculate bid price with standard markups."""

        overhead = direct_cost * overhead_rate
        subtotal1 = direct_cost + overhead

        profit = subtotal1 * profit_rate
        subtotal2 = subtotal1 + profit

        bond = subtotal2 * bond_rate
        subtotal3 = subtotal2 + bond

        contingency = direct_cost * contingency_rate

        total = subtotal3 + contingency

        return {
            'direct_cost': round(direct_cost, 2),
            'overhead': round(overhead, 2),
            'overhead_rate': f"{overhead_rate:.1%}",
            'profit': round(profit, 2),
            'profit_rate': f"{profit_rate:.1%}",
            'bond': round(bond, 2),
            'bond_rate': f"{bond_rate:.1%}",
            'contingency': round(contingency, 2),
            'contingency_rate': f"{contingency_rate:.1%}",
            'bid_price': round(total, 2),
            'total_markup': round(total - direct_cost, 2),
            'total_markup_pct': round((total - direct_cost) / direct_cost * 100, 1)
        }

    def compare_markup_scenarios(self,
                                  direct_cost: float,
                                  scenarios: Dict[str, Dict[str, float]]) -> pd.DataFrame:
        """Compare different markup scenarios."""

        results = []

        for name, rates in scenarios.items():
            schedule = self.create_markup_schedule(name, rates)
            pricing = self.apply_markups(direct_cost, schedule)

            results.append({
                'Scenario': name,
                'Direct Cost': pricing.direct_cost,
                'Total Markup': pricing.total_markup,
                'Markup %': pricing.markup_percentage,
                'Total Price': pricing.total_price
            })

        return pd.DataFrame(results)

    def export_pricing(self,
                        result: PricingResult,
                        output_path: str) -> str:
        """Export pricing breakdown to Excel."""

        with pd.ExcelWriter(output_path, engine='openpyxl') as writer:
            # Summary
            summary_df = pd.DataFrame([{
                'Direct Cost': result.direct_cost,
                'Labor': result.labor_cost,
                'Material': result.material_cost,
                'Equipment': result.equipment_cost,
                'Subcontractor': result.subcontractor_cost,
                'Total Markup': result.total_markup,
                'Markup %': result.markup_percentage,
                'Total Price': result.total_price
            }])
            summary_df.to_excel(writer, sheet_name='Summary', index=False)

            # Markup Details
            markup_df = pd.DataFrame([
                {
                    'Markup': m.name,
                    'Type': m.markup_type.value,
                    'Rate': f"{m.rate:.1%}",
                    'Base': m.base_amount,
                    'Amount': m.markup_amount
                }
                for m in result.markups
            ])
            markup_df.to_excel(writer, sheet_name='Markups', index=False)

        return output_path
```

## Quick Start

```python
# Initialize markup calculator
markup = CWICROverheadMarkup()

# Calculate bid price
bid = markup.calculate_bid_price(
    direct_cost=1000000,
    overhead_rate=0.12,
    profit_rate=0.08
)

print(f"Direct Cost: ${bid['direct_cost']:,.2f}")
print(f"Bid Price: ${bid['bid_price']:,.2f}")
print(f"Total Markup: {bid['total_markup_pct']}%")
```

## Common Use Cases

### 1. Template-Based Pricing
```python
cwicr = pd.read_parquet("ddc_cwicr_en.parquet")
markup = CWICROverheadMarkup(cwicr)

items = [
    {'work_item_code': 'CONC-001', 'quantity': 150},
    {'work_item_code': 'STRL-002', 'quantity': 25}
]

pricing = markup.price_estimate(items, template='commercial')
print(f"Total Price: ${pricing.total_price:,.2f}")
```

### 2. Compare Scenarios
```python
scenarios = {
    'Aggressive': {'overhead': 0.08, 'profit': 0.05},
    'Standard': {'overhead': 0.12, 'profit': 0.08},
    'Premium': {'overhead': 0.15, 'profit': 0.12}
}

comparison = markup.compare_markup_scenarios(1000000, scenarios)
print(comparison)
```

### 3. Custom Markup Schedule
```python
schedule = markup.create_markup_schedule('Custom', {
    'overhead': 0.10,
    'profit': 0.08,
    'bond': 0.02,
    'insurance': 0.015
})

pricing = markup.apply_markups(500000, schedule)
```

## Resources
- **GitHub**: [OpenConstructionEstimate-Jens-CWICR](https://github.com/jens-construction/OpenConstructionEstimate-Jens-CWICR)
- **Jens Book**: Chapter 3.1 - Cost Markup Methods


---


# CWICR Productivity Tracker

## Business Case

### Problem Statement
Project performance tracking requires:
- Comparing actual vs planned productivity
- Identifying underperforming activities
- Forecasting completion dates
- Learning from historical data

### Solution
Track productivity by comparing actual hours/quantities against CWICR norms, generating variance analysis and forecasts.

### Business Value
- **Performance visibility** - Real-time productivity metrics
- **Early warning** - Identify issues before escalation
- **Continuous improvement** - Learn from variances
- **Accurate forecasting** - Data-driven predictions

## Technical Implementation

```python
import pandas as pd
import numpy as np
from typing import Dict, Any, List, Optional, Tuple
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum
from collections import defaultdict


class PerformanceStatus(Enum):
    """Performance status categories."""
    EXCELLENT = "excellent"      # >110% productivity
    ON_TARGET = "on_target"      # 90-110%
    BELOW_TARGET = "below_target"  # 70-90%
    CRITICAL = "critical"        # <70%


@dataclass
class ProductivityRecord:
    """Single productivity record."""
    work_item_code: str
    description: str
    date: datetime
    planned_hours: float
    actual_hours: float
    planned_quantity: float
    actual_quantity: float
    productivity_rate: float  # Percentage
    status: PerformanceStatus
    variance_hours: float
    labor_cost_variance: float


@dataclass
class ProductivitySummary:
    """Productivity summary for period/project."""
    period_start: datetime
    period_end: datetime
    total_planned_hours: float
    total_actual_hours: float
    overall_productivity: float
    hours_variance: float
    cost_variance: float
    records: List[ProductivityRecord]
    by_status: Dict[str, int]
    by_category: Dict[str, float]
    trend: List[float]  # Daily/weekly productivity trend


class CWICRProductivityTracker:
    """Track productivity against CWICR norms."""

    def __init__(self, cwicr_data: pd.DataFrame,
                 labor_rate: float = 35.0):
        self.work_items = cwicr_data
        self.labor_rate = labor_rate
        self._index_data()

    def _index_data(self):
        """Index work items for fast lookup."""
        if 'work_item_code' in self.work_items.columns:
            self._work_index = self.work_items.set_index('work_item_code')
        else:
            self._work_index = None

    def _get_status(self, productivity_rate: float) -> PerformanceStatus:
        """Determine performance status from productivity rate."""
        if productivity_rate >= 110:
            return PerformanceStatus.EXCELLENT
        elif productivity_rate >= 90:
            return PerformanceStatus.ON_TARGET
        elif productivity_rate >= 70:
            return PerformanceStatus.BELOW_TARGET
        else:
            return PerformanceStatus.CRITICAL

    def calculate_productivity(self,
                               work_item_code: str,
                               actual_hours: float,
                               actual_quantity: float,
                               date: datetime = None) -> ProductivityRecord:
        """Calculate productivity for single work item."""

        if date is None:
            date = datetime.now()

        if self._work_index is not None and work_item_code in self._work_index.index:
            work_item = self._work_index.loc[work_item_code]
            labor_norm = float(work_item.get('labor_norm', 0) or 0)
            planned_hours = labor_norm * actual_quantity

            # Productivity rate (planned/actual * 100)
            productivity_rate = (planned_hours / actual_hours * 100) if actual_hours > 0 else 0

            # Variances
            hours_variance = planned_hours - actual_hours
            cost_variance = hours_variance * self.labor_rate

            return ProductivityRecord(
                work_item_code=work_item_code,
                description=str(work_item.get('description', '')),
                date=date,
                planned_hours=round(planned_hours, 2),
                actual_hours=actual_hours,
                planned_quantity=actual_quantity,  # Using actual as target
                actual_quantity=actual_quantity,
                productivity_rate=round(productivity_rate, 1),
                status=self._get_status(productivity_rate),
                variance_hours=round(hours_variance, 2),
                labor_cost_variance=round(cost_variance, 2)
            )
        else:
            return ProductivityRecord(
                work_item_code=work_item_code,
                description="NOT FOUND",
                date=date,
                planned_hours=0,
                actual_hours=actual_hours,
                planned_quantity=actual_quantity,
                actual_quantity=actual_quantity,
                productivity_rate=0,
                status=PerformanceStatus.CRITICAL,
                variance_hours=0,
                labor_cost_variance=0
            )

    def track_daily_production(self,
                                records: List[Dict[str, Any]]) -> ProductivitySummary:
        """Track daily production from multiple records."""

        productivity_records = []

        for record in records:
            prod = self.calculate_productivity(
                work_item_code=record.get('work_item_code', record.get('code')),
                actual_hours=record.get('actual_hours', 0),
                actual_quantity=record.get('actual_quantity', 0),
                date=record.get('date', datetime.now())
            )
            productivity_records.append(prod)

        # Aggregate
        total_planned = sum(r.planned_hours for r in productivity_records)
        total_actual = sum(r.actual_hours for r in productivity_records)

        overall_productivity = (total_planned / total_actual * 100) if total_actual > 0 else 0

        # By status
        by_status = defaultdict(int)
        for r in productivity_records:
            by_status[r.status.value] += 1

        # Get date range
        dates = [r.date for r in productivity_records if r.date]
        period_start = min(dates) if dates else datetime.now()
        period_end = max(dates) if dates else datetime.now()

        return ProductivitySummary(
            period_start=period_start,
            period_end=period_end,
            total_planned_hours=round(total_planned, 2),
            total_actual_hours=round(total_actual, 2),
            overall_productivity=round(overall_productivity, 1),
            hours_variance=round(total_planned - total_actual, 2),
            cost_variance=round((total_planned - total_actual) * self.labor_rate, 2),
            records=productivity_records,
            by_status=dict(by_status),
            by_category={},
            trend=[]
        )

    def forecast_completion(self,
                            remaining_work: List[Dict[str, Any]],
                            current_productivity: float,
                            available_hours_per_day: float = 80) -> Dict[str, Any]:
        """Forecast completion based on current productivity."""

        # Calculate remaining planned hours
        total_planned = 0
        for item in remaining_work:
            code = item.get('work_item_code', item.get('code'))
            qty = item.get('quantity', 0)

            if self._work_index is not None and code in self._work_index.index:
                work_item = self._work_index.loc[code]
                labor_norm = float(work_item.get('labor_norm', 0) or 0)
                total_planned += labor_norm * qty

        # Adjust for productivity
        if current_productivity > 0:
            actual_hours_needed = total_planned / (current_productivity / 100)
        else:
            actual_hours_needed = total_planned

        # Days to complete
        days_to_complete = actual_hours_needed / available_hours_per_day if available_hours_per_day > 0 else 0

        return {
            'remaining_planned_hours': round(total_planned, 1),
            'estimated_actual_hours': round(actual_hours_needed, 1),
            'current_productivity': current_productivity,
            'days_to_complete': int(np.ceil(days_to_complete)),
            'forecasted_completion': datetime.now() + timedelta(days=int(np.ceil(days_to_complete))),
            'productivity_impact': round(actual_hours_needed - total_planned, 1)
        }

    def analyze_variance(self,
                         summary: ProductivitySummary) -> Dict[str, Any]:
        """Analyze productivity variances in detail."""

        # Get critical items
        critical = [r for r in summary.records if r.status == PerformanceStatus.CRITICAL]
        below_target = [r for r in summary.records if r.status == PerformanceStatus.BELOW_TARGET]

        # Top impact items (by cost variance)
        sorted_by_impact = sorted(summary.records, key=lambda x: x.labor_cost_variance)
        top_negative = [r for r in sorted_by_impact[:5] if r.labor_cost_variance < 0]
        top_positive = [r for r in sorted_by_impact[-5:] if r.labor_cost_variance > 0]

        return {
            'overall_productivity': summary.overall_productivity,
            'total_hours_variance': summary.hours_variance,
            'total_cost_variance': summary.cost_variance,
            'critical_items_count': len(critical),
            'below_target_count': len(below_target),
            'critical_items': [
                {'code': r.work_item_code, 'productivity': r.productivity_rate, 'variance': r.labor_cost_variance}
                for r in critical
            ],
            'top_negative_impact': [
                {'code': r.work_item_code, 'variance': r.labor_cost_variance}
                for r in top_negative
            ],
            'top_positive_impact': [
                {'code': r.work_item_code, 'variance': r.labor_cost_variance}
                for r in top_positive
            ],
            'recommendations': self._generate_recommendations(critical, below_target)
        }

    def _generate_recommendations(self,
                                   critical: List[ProductivityRecord],
                                   below_target: List[ProductivityRecord]) -> List[str]:
        """Generate improvement recommendations."""
        recommendations = []

        if len(critical) > 0:
            recommendations.append(
                f"Immediate attention needed for {len(critical)} critical items"
            )

        if len(below_target) > 3:
            recommendations.append(
                "Consider crew training or method review for underperforming activities"
            )

        # Check for patterns
        critical_codes = [r.work_item_code for r in critical]
        if any('CONC' in code for code in critical_codes):
            recommendations.append("Review concrete work methods and crew composition")
        if any('EXCV' in code for code in critical_codes):
            recommendations.append("Check equipment availability and operator skills for excavation")

        return recommendations

    def export_report(self,
                      summary: ProductivitySummary,
                      output_path: str) -> str:
        """Export productivity report to Excel."""

        with pd.ExcelWriter(output_path, engine='openpyxl') as writer:
            # Details
            details_df = pd.DataFrame([
                {
                    'Work Item': r.work_item_code,
                    'Description': r.description,
                    'Date': r.date.strftime('%Y-%m-%d'),
                    'Planned Hours': r.planned_hours,
                    'Actual Hours': r.actual_hours,
                    'Productivity %': r.productivity_rate,
                    'Status': r.status.value,
                    'Hours Variance': r.variance_hours,
                    'Cost Variance': r.labor_cost_variance
                }
                for r in summary.records
            ])
            details_df.to_excel(writer, sheet_name='Details', index=False)

            # Summary
            summary_df = pd.DataFrame([{
                'Period Start': summary.period_start.strftime('%Y-%m-%d'),
                'Period End': summary.period_end.strftime('%Y-%m-%d'),
                'Total Planned Hours': summary.total_planned_hours,
                'Total Actual Hours': summary.total_actual_hours,
                'Overall Productivity %': summary.overall_productivity,
                'Hours Variance': summary.hours_variance,
                'Cost Variance': summary.cost_variance
            }])
            summary_df.to_excel(writer, sheet_name='Summary', index=False)

            # By Status
            status_df = pd.DataFrame([
                {'Status': status, 'Count': count}
                for status, count in summary.by_status.items()
            ])
            status_df.to_excel(writer, sheet_name='By Status', index=False)

        return output_path


class ProductivityDashboard:
    """Generate productivity dashboard data."""

    def __init__(self, tracker: CWICRProductivityTracker):
        self.tracker = tracker

    def get_kpis(self, summary: ProductivitySummary) -> Dict[str, Any]:
        """Get key performance indicators."""
        return {
            'overall_productivity': summary.overall_productivity,
            'productivity_status': 'Good' if summary.overall_productivity >= 90 else 'Needs Attention',
            'hours_saved': max(0, summary.hours_variance),
            'hours_over': abs(min(0, summary.hours_variance)),
            'cost_impact': summary.cost_variance,
            'items_on_target': summary.by_status.get('on_target', 0) + summary.by_status.get('excellent', 0),
            'items_below_target': summary.by_status.get('below_target', 0) + summary.by_status.get('critical', 0)
        }

    def get_trend_data(self,
                       historical_summaries: List[ProductivitySummary]) -> pd.DataFrame:
        """Get productivity trend data for charting."""
        data = []
        for s in historical_summaries:
            data.append({
                'date': s.period_end.strftime('%Y-%m-%d'),
                'productivity': s.overall_productivity,
                'planned_hours': s.total_planned_hours,
                'actual_hours': s.total_actual_hours
            })
        return pd.DataFrame(data)
```

## Quick Start

```python
# Load CWICR data
cwicr = pd.read_parquet("ddc_cwicr_en.parquet")

# Initialize tracker
tracker = CWICRProductivityTracker(cwicr, labor_rate=35.0)

# Track daily production
records = [
    {'work_item_code': 'CONC-001', 'actual_hours': 45, 'actual_quantity': 50},
    {'work_item_code': 'REBAR-002', 'actual_hours': 32, 'actual_quantity': 2000},
    {'work_item_code': 'EXCV-003', 'actual_hours': 28, 'actual_quantity': 100}
]

summary = tracker.track_daily_production(records)

print(f"Overall Productivity: {summary.overall_productivity}%")
print(f"Hours Variance: {summary.hours_variance}")
print(f"Cost Variance: ${summary.cost_variance:,.2f}")
```

## Common Use Cases

### 1. Variance Analysis
```python
analysis = tracker.analyze_variance(summary)
for rec in analysis['recommendations']:
    print(rec)
```

### 2. Completion Forecast
```python
remaining = [
    {'work_item_code': 'CONC-001', 'quantity': 100},
    {'work_item_code': 'REBAR-002', 'quantity': 5000}
]
forecast = tracker.forecast_completion(remaining, current_productivity=85.0)
print(f"Days to Complete: {forecast['days_to_complete']}")
```

### 3. Export Report
```python
tracker.export_report(summary, "productivity_report.xlsx")
```

## Resources
- **GitHub**: [OpenConstructionEstimate-Jens-CWICR](https://github.com/jens-construction/OpenConstructionEstimate-Jens-CWICR)
- **Jens Book**: Chapter 3.1 - Productivity Management


---


# CWICR Quantity Matcher

## Business Case

### Problem Statement
BIM exports contain quantities but:
- Element categories don't match cost codes
- Manual mapping is error-prone
- Different naming conventions
- Need consistent code assignment

### Solution
Intelligent matching of BIM element quantities to CWICR work items using category mapping, semantic matching, and rule-based assignment.

### Business Value
- **Automation** - Reduce manual mapping effort
- **Consistency** - Standard code assignment
- **Accuracy** - Validated quantity linkage
- **Integration** - BIM-to-cost data flow

## Technical Implementation

```python
import pandas as pd
import numpy as np
from typing import Dict, Any, List, Optional, Tuple
from dataclasses import dataclass, field
from enum import Enum
import re
from difflib import SequenceMatcher


class MatchMethod(Enum):
    """Methods for matching BIM elements to work items."""
    EXACT = "exact"
    CATEGORY = "category"
    SEMANTIC = "semantic"
    RULE_BASED = "rule_based"
    MANUAL = "manual"


class MatchConfidence(Enum):
    """Confidence level of match."""
    HIGH = "high"       # >90% confidence
    MEDIUM = "medium"   # 70-90%
    LOW = "low"         # 50-70%
    MANUAL = "manual"   # <50% - needs review


@dataclass
class QuantityMatch:
    """Single quantity match result."""
    bim_element_id: str
    bim_category: str
    bim_description: str
    bim_quantity: float
    bim_unit: str
    matched_work_item: str
    work_item_description: str
    work_item_unit: str
    match_method: MatchMethod
    confidence: MatchConfidence
    confidence_score: float
    unit_conversion_factor: float = 1.0


@dataclass
class MatchingResult:
    """Complete matching result."""
    total_elements: int
    matched: int
    unmatched: int
    high_confidence: int
    needs_review: int
    matches: List[QuantityMatch]
    unmatched_elements: List[Dict[str, Any]]


# Category to work item mapping rules
CATEGORY_MAPPING = {
    # Revit categories to CWICR prefixes
    'walls': ['WALL', 'MSNR', 'PART'],
    'floors': ['CONC', 'FLOOR', 'SLAB'],
    'columns': ['CONC', 'STRL', 'COLM'],
    'beams': ['CONC', 'STRL', 'BEAM'],
    'foundations': ['CONC', 'FNDN', 'EXCV'],
    'roofs': ['ROOF', 'INSUL'],
    'doors': ['DOOR', 'CARP'],
    'windows': ['WIND', 'GLAZ'],
    'stairs': ['STAIR', 'CONC'],
    'railings': ['RAIL', 'METL'],
    'ceilings': ['CEIL', 'FINI'],
    'structural framing': ['STRL', 'STEE'],
    'structural columns': ['STRL', 'COLM'],
    'pipes': ['PLMB', 'PIPE'],
    'ducts': ['HVAC', 'DUCT'],
    'conduits': ['ELEC', 'COND'],
    'cable trays': ['ELEC', 'CABL'],
    'concrete': ['CONC'],
    'rebar': ['REBAR', 'RENF'],
    'formwork': ['FORM', 'CONC'],
}

# Unit conversion mapping
UNIT_CONVERSIONS = {
    ('sf', 'm2'): 0.092903,
    ('m2', 'sf'): 10.7639,
    ('cy', 'm3'): 0.764555,
    ('m3', 'cy'): 1.30795,
    ('lf', 'm'): 0.3048,
    ('m', 'lf'): 3.28084,
    ('lb', 'kg'): 0.453592,
    ('kg', 'lb'): 2.20462,
}


class CWICRQuantityMatcher:
    """Match BIM quantities to CWICR work items."""

    def __init__(self, cwicr_data: pd.DataFrame):
        self.work_items = cwicr_data
        self._index_data()
        self._build_search_index()

    def _index_data(self):
        """Index work items."""
        if 'work_item_code' in self.work_items.columns:
            self._code_index = self.work_items.set_index('work_item_code')
        else:
            self._code_index = None

    def _build_search_index(self):
        """Build search index for semantic matching."""
        self._search_index = {}

        if 'description' in self.work_items.columns:
            for _, row in self.work_items.iterrows():
                code = row.get('work_item_code', '')
                desc = str(row.get('description', '')).lower()

                # Index by keywords
                words = re.findall(r'\w+', desc)
                for word in words:
                    if len(word) > 3:
                        if word not in self._search_index:
                            self._search_index[word] = []
                        self._search_index[word].append(code)

    def _get_category_codes(self, category: str) -> List[str]:
        """Get potential work item prefixes for BIM category."""
        cat_lower = category.lower().strip()

        for key, prefixes in CATEGORY_MAPPING.items():
            if key in cat_lower:
                return prefixes

        return []

    def _semantic_match(self, description: str, category: str) -> List[Tuple[str, float]]:
        """Find work items using semantic matching."""
        desc_lower = description.lower()
        words = re.findall(r'\w+', desc_lower)

        # Find candidate codes
        candidates = {}
        for word in words:
            if word in self._search_index:
                for code in self._search_index[word]:
                    if code not in candidates:
                        candidates[code] = 0
                    candidates[code] += 1

        # Score candidates
        scored = []
        for code, count in candidates.items():
            if self._code_index is not None and code in self._code_index.index:
                item_desc = str(self._code_index.loc[code].get('description', ''))
                similarity = SequenceMatcher(None, desc_lower, item_desc.lower()).ratio()
                score = (count * 0.4) + (similarity * 0.6)
                scored.append((code, score))

        return sorted(scored, key=lambda x: x[1], reverse=True)[:5]

    def _get_confidence(self, score: float) -> MatchConfidence:
        """Determine confidence level from score."""
        if score >= 0.9:
            return MatchConfidence.HIGH
        elif score >= 0.7:
            return MatchConfidence.MEDIUM
        elif score >= 0.5:
            return MatchConfidence.LOW
        else:
            return MatchConfidence.MANUAL

    def _get_unit_conversion(self, from_unit: str, to_unit: str) -> float:
        """Get unit conversion factor."""
        from_norm = from_unit.lower().strip()
        to_norm = to_unit.lower().strip()

        if from_norm == to_norm:
            return 1.0

        return UNIT_CONVERSIONS.get((from_norm, to_norm), 1.0)

    def match_element(self,
                      element: Dict[str, Any],
                      element_id_col: str = 'ElementId',
                      category_col: str = 'Category',
                      description_col: str = 'Description',
                      quantity_col: str = 'Quantity',
                      unit_col: str = 'Unit') -> Optional[QuantityMatch]:
        """Match single BIM element to work item."""

        element_id = str(element.get(element_id_col, ''))
        category = str(element.get(category_col, ''))
        description = str(element.get(description_col, ''))
        quantity = float(element.get(quantity_col, 0) or 0)
        unit = str(element.get(unit_col, ''))

        # Try category-based matching first
        category_prefixes = self._get_category_codes(category)

        best_match = None
        best_score = 0
        match_method = MatchMethod.CATEGORY

        if category_prefixes:
            # Filter work items by prefix
            for prefix in category_prefixes:
                matches = self.work_items[
                    self.work_items['work_item_code'].str.startswith(prefix)
                ]

                for _, item in matches.iterrows():
                    item_desc = str(item.get('description', ''))
                    similarity = SequenceMatcher(None, description.lower(), item_desc.lower()).ratio()

                    if similarity > best_score:
                        best_score = similarity
                        best_match = item

        # If no good match, try semantic matching
        if best_score < 0.5:
            semantic_matches = self._semantic_match(description, category)
            if semantic_matches:
                top_code, top_score = semantic_matches[0]
                if top_score > best_score:
                    best_match = self._code_index.loc[top_code]
                    best_score = top_score
                    match_method = MatchMethod.SEMANTIC

        if best_match is None or best_score < 0.3:
            return None

        # Get unit conversion
        work_item_unit = str(best_match.get('unit', ''))
        conversion = self._get_unit_conversion(unit, work_item_unit)

        return QuantityMatch(
            bim_element_id=element_id,
            bim_category=category,
            bim_description=description,
            bim_quantity=quantity,
            bim_unit=unit,
            matched_work_item=str(best_match.get('work_item_code', best_match.name)),
            work_item_description=str(best_match.get('description', '')),
            work_item_unit=work_item_unit,
            match_method=match_method,
            confidence=self._get_confidence(best_score),
            confidence_score=round(best_score, 2),
            unit_conversion_factor=conversion
        )

    def match_quantities(self,
                         bim_data: pd.DataFrame,
                         element_id_col: str = 'ElementId',
                         category_col: str = 'Category',
                         description_col: str = 'Description',
                         quantity_col: str = 'Quantity',
                         unit_col: str = 'Unit') -> MatchingResult:
        """Match all BIM quantities to work items."""

        matches = []
        unmatched = []

        for _, row in bim_data.iterrows():
            element = row.to_dict()

            match = self.match_element(
                element,
                element_id_col,
                category_col,
                description_col,
                quantity_col,
                unit_col
            )

            if match:
                matches.append(match)
            else:
                unmatched.append(element)

        return MatchingResult(
            total_elements=len(bim_data),
            matched=len(matches),
            unmatched=len(unmatched),
            high_confidence=len([m for m in matches if m.confidence == MatchConfidence.HIGH]),
            needs_review=len([m for m in matches if m.confidence == MatchConfidence.MANUAL]),
            matches=matches,
            unmatched_elements=unmatched
        )

    def apply_custom_mapping(self,
                              result: MatchingResult,
                              mapping: Dict[str, str]) -> MatchingResult:
        """Apply custom category to work item mapping."""

        updated_matches = []

        for match in result.matches:
            if match.bim_category in mapping:
                # Override with custom mapping
                code = mapping[match.bim_category]
                if self._code_index is not None and code in self._code_index.index:
                    item = self._code_index.loc[code]
                    match.matched_work_item = code
                    match.work_item_description = str(item.get('description', ''))
                    match.work_item_unit = str(item.get('unit', ''))
                    match.match_method = MatchMethod.RULE_BASED
                    match.confidence = MatchConfidence.HIGH
                    match.confidence_score = 1.0

            updated_matches.append(match)

        result.matches = updated_matches
        return result

    def export_matches(self,
                        result: MatchingResult,
                        output_path: str) -> str:
        """Export matching results to Excel."""

        with pd.ExcelWriter(output_path, engine='openpyxl') as writer:
            # Summary
            summary_df = pd.DataFrame([{
                'Total Elements': result.total_elements,
                'Matched': result.matched,
                'Unmatched': result.unmatched,
                'High Confidence': result.high_confidence,
                'Needs Review': result.needs_review,
                'Match Rate %': round(result.matched / result.total_elements * 100, 1) if result.total_elements > 0 else 0
            }])
            summary_df.to_excel(writer, sheet_name='Summary', index=False)

            # Matches
            matches_df = pd.DataFrame([
                {
                    'BIM Element ID': m.bim_element_id,
                    'BIM Category': m.bim_category,
                    'BIM Description': m.bim_description,
                    'BIM Quantity': m.bim_quantity,
                    'BIM Unit': m.bim_unit,
                    'Work Item Code': m.matched_work_item,
                    'Work Item Description': m.work_item_description,
                    'Work Item Unit': m.work_item_unit,
                    'Converted Quantity': m.bim_quantity * m.unit_conversion_factor,
                    'Match Method': m.match_method.value,
                    'Confidence': m.confidence.value,
                    'Score': m.confidence_score
                }
                for m in result.matches
            ])
            matches_df.to_excel(writer, sheet_name='Matches', index=False)

            # Needs Review
            review_df = matches_df[matches_df['Confidence'].isin(['low', 'manual'])]
            review_df.to_excel(writer, sheet_name='Needs Review', index=False)

            # Unmatched
            unmatched_df = pd.DataFrame(result.unmatched_elements)
            unmatched_df.to_excel(writer, sheet_name='Unmatched', index=False)

        return output_path

    def generate_cost_linked_qto(self,
                                   result: MatchingResult) -> pd.DataFrame:
        """Generate cost-linked QTO from matches."""

        data = []
        for match in result.matches:
            if self._code_index is not None and match.matched_work_item in self._code_index.index:
                item = self._code_index.loc[match.matched_work_item]

                converted_qty = match.bim_quantity * match.unit_conversion_factor

                labor = float(item.get('labor_cost', 0) or 0)
                material = float(item.get('material_cost', 0) or 0)
                equipment = float(item.get('equipment_cost', 0) or 0)
                unit_cost = labor + material + equipment

                data.append({
                    'Work Item Code': match.matched_work_item,
                    'Description': match.work_item_description,
                    'Unit': match.work_item_unit,
                    'Quantity': round(converted_qty, 2),
                    'Unit Cost': round(unit_cost, 2),
                    'Total Cost': round(converted_qty * unit_cost, 2),
                    'BIM Elements': 1,
                    'Confidence': match.confidence.value
                })

        df = pd.DataFrame(data)

        # Aggregate by work item
        if not df.empty:
            aggregated = df.groupby(['Work Item Code', 'Description', 'Unit']).agg({
                'Quantity': 'sum',
                'Unit Cost': 'first',
                'BIM Elements': 'sum'
            }).reset_index()
            aggregated['Total Cost'] = aggregated['Quantity'] * aggregated['Unit Cost']
            return aggregated

        return df
```

## Quick Start

```python
# Load CWICR data
cwicr = pd.read_parquet("ddc_cwicr_en.parquet")

# Initialize matcher
matcher = CWICRQuantityMatcher(cwicr)

# Load BIM quantities
bim_qto = pd.read_excel("revit_quantities.xlsx")

# Match quantities
result = matcher.match_quantities(bim_qto)

print(f"Matched: {result.matched}/{result.total_elements}")
print(f"High Confidence: {result.high_confidence}")
print(f"Needs Review: {result.needs_review}")
```

## Common Use Cases

### 1. Generate Cost-Linked QTO
```python
qto_with_costs = matcher.generate_cost_linked_qto(result)
print(f"Total Cost: ${qto_with_costs['Total Cost'].sum():,.2f}")
```

### 2. Custom Mapping Rules
```python
custom_mapping = {
    'Walls': 'WALL-001',
    'Floors': 'CONC-002',
    'Structural Columns': 'STRL-003'
}
result = matcher.apply_custom_mapping(result, custom_mapping)
```

### 3. Export Results
```python
matcher.export_matches(result, "quantity_matching.xlsx")
```

## Resources
- **GitHub**: [OpenConstructionEstimate-Jens-CWICR](https://github.com/jens-construction/OpenConstructionEstimate-Jens-CWICR)
- **Jens Book**: Chapter 2.3 - BIM-to-Cost Integration


---


# CWICR Rate Updater

## Business Case

### Problem Statement
Resource rates become outdated:
- Material prices fluctuate with market
- Labor rates change annually
- Equipment costs vary by region
- Historical rates need adjustment

### Solution
Systematic rate updates integrating market data, inflation indices, and regional factors while maintaining audit trail.

### Business Value
- **Accuracy** - Current market pricing
- **Flexibility** - Update specific resources or categories
- **Audit trail** - Track rate changes over time
- **Automation** - Integrate with price APIs

## Technical Implementation

```python
import pandas as pd
import numpy as np
from typing import Dict, Any, List, Optional, Tuple, Callable
from dataclasses import dataclass, field
from datetime import datetime, date
from enum import Enum
import json


class RateType(Enum):
    """Types of rates."""
    LABOR = "labor"
    MATERIAL = "material"
    EQUIPMENT = "equipment"
    SUBCONTRACT = "subcontract"


class AdjustmentMethod(Enum):
    """Methods for rate adjustment."""
    FIXED_AMOUNT = "fixed_amount"
    PERCENTAGE = "percentage"
    MULTIPLIER = "multiplier"
    REPLACEMENT = "replacement"


@dataclass
class RateChange:
    """Record of rate change."""
    resource_code: str
    rate_type: RateType
    old_rate: float
    new_rate: float
    change_percent: float
    change_date: datetime
    reason: str
    source: str


@dataclass
class RateUpdateResult:
    """Result of rate update operation."""
    total_items: int
    updated: int
    unchanged: int
    errors: int
    changes: List[RateChange]
    summary: Dict[str, Any]


class CWICRRateUpdater:
    """Update resource rates in CWICR data."""

    def __init__(self, cwicr_data: pd.DataFrame):
        self.data = cwicr_data.copy()
        self.change_log: List[RateChange] = []
        self.original_data = cwicr_data.copy()

    def get_current_rates(self,
                          rate_type: RateType = None,
                          category: str = None) -> pd.DataFrame:
        """Get current rates, optionally filtered."""

        df = self.data.copy()

        # Filter by category if specified
        if category and 'category' in df.columns:
            df = df[df['category'].str.contains(category, case=False, na=False)]

        # Select relevant columns based on rate type
        rate_columns = {
            RateType.LABOR: ['work_item_code', 'description', 'labor_rate', 'labor_cost'],
            RateType.MATERIAL: ['work_item_code', 'description', 'material_cost'],
            RateType.EQUIPMENT: ['work_item_code', 'description', 'equipment_cost', 'equipment_rate']
        }

        if rate_type and rate_type in rate_columns:
            cols = [c for c in rate_columns[rate_type] if c in df.columns]
            return df[cols]

        return df

    def update_rate(self,
                    work_item_code: str,
                    rate_type: RateType,
                    new_rate: float,
                    reason: str = "Manual update",
                    source: str = "User") -> Optional[RateChange]:
        """Update single rate."""

        rate_column = self._get_rate_column(rate_type)
        if rate_column not in self.data.columns:
            return None

        mask = self.data['work_item_code'] == work_item_code
        if not mask.any():
            return None

        old_rate = float(self.data.loc[mask, rate_column].iloc[0])
        self.data.loc[mask, rate_column] = new_rate

        change_percent = ((new_rate - old_rate) / old_rate * 100) if old_rate > 0 else 0

        change = RateChange(
            resource_code=work_item_code,
            rate_type=rate_type,
            old_rate=old_rate,
            new_rate=new_rate,
            change_percent=round(change_percent, 2),
            change_date=datetime.now(),
            reason=reason,
            source=source
        )

        self.change_log.append(change)
        return change

    def _get_rate_column(self, rate_type: RateType) -> str:
        """Get column name for rate type."""
        mapping = {
            RateType.LABOR: 'labor_rate',
            RateType.MATERIAL: 'material_cost',
            RateType.EQUIPMENT: 'equipment_cost',
            RateType.SUBCONTRACT: 'subcontract_cost'
        }
        return mapping.get(rate_type, 'labor_rate')

    def apply_percentage_adjustment(self,
                                     rate_type: RateType,
                                     percentage: float,
                                     category: str = None,
                                     reason: str = "Percentage adjustment") -> RateUpdateResult:
        """Apply percentage adjustment to rates."""

        rate_column = self._get_rate_column(rate_type)
        if rate_column not in self.data.columns:
            return RateUpdateResult(0, 0, 0, 1, [], {})

        # Build mask
        mask = pd.Series([True] * len(self.data))
        if category and 'category' in self.data.columns:
            mask = self.data['category'].str.contains(category, case=False, na=False)

        # Store old values
        old_values = self.data.loc[mask, rate_column].copy()

        # Apply adjustment
        multiplier = 1 + (percentage / 100)
        self.data.loc[mask, rate_column] = old_values * multiplier

        # Record changes
        changes = []
        for idx in self.data[mask].index:
            old_rate = float(old_values.loc[idx])
            new_rate = float(self.data.loc[idx, rate_column])

            if old_rate != new_rate:
                change = RateChange(
                    resource_code=str(self.data.loc[idx, 'work_item_code']),
                    rate_type=rate_type,
                    old_rate=old_rate,
                    new_rate=new_rate,
                    change_percent=percentage,
                    change_date=datetime.now(),
                    reason=reason,
                    source=f"Bulk {percentage}%"
                )
                changes.append(change)
                self.change_log.append(change)

        return RateUpdateResult(
            total_items=len(self.data[mask]),
            updated=len(changes),
            unchanged=len(self.data[mask]) - len(changes),
            errors=0,
            changes=changes,
            summary={
                'rate_type': rate_type.value,
                'adjustment_percent': percentage,
                'category': category,
                'average_new_rate': self.data.loc[mask, rate_column].mean()
            }
        )

    def apply_inflation_index(self,
                               base_year: int,
                               current_year: int,
                               inflation_rates: Dict[int, float],
                               rate_types: List[RateType] = None) -> RateUpdateResult:
        """Apply inflation index from base year to current."""

        if rate_types is None:
            rate_types = [RateType.LABOR, RateType.MATERIAL, RateType.EQUIPMENT]

        # Calculate cumulative multiplier
        cumulative_multiplier = 1.0
        for year in range(base_year, current_year):
            rate = inflation_rates.get(year, 0.02)  # Default 2%
            cumulative_multiplier *= (1 + rate)

        total_changes = []

        for rate_type in rate_types:
            result = self.apply_percentage_adjustment(
                rate_type=rate_type,
                percentage=(cumulative_multiplier - 1) * 100,
                reason=f"Inflation {base_year}-{current_year}"
            )
            total_changes.extend(result.changes)

        return RateUpdateResult(
            total_items=len(self.data),
            updated=len(total_changes),
            unchanged=len(self.data) - len(total_changes),
            errors=0,
            changes=total_changes,
            summary={
                'base_year': base_year,
                'current_year': current_year,
                'cumulative_multiplier': round(cumulative_multiplier, 4),
                'total_adjustment_percent': round((cumulative_multiplier - 1) * 100, 2)
            }
        )

    def import_external_rates(self,
                               external_data: pd.DataFrame,
                               code_column: str,
                               rate_column: str,
                               rate_type: RateType,
                               match_on: str = 'work_item_code') -> RateUpdateResult:
        """Import rates from external data source."""

        changes = []
        errors = 0
        target_column = self._get_rate_column(rate_type)

        for _, row in external_data.iterrows():
            code = row[code_column]
            new_rate = row[rate_column]

            try:
                change = self.update_rate(
                    work_item_code=code,
                    rate_type=rate_type,
                    new_rate=new_rate,
                    reason="External import",
                    source="External data"
                )
                if change:
                    changes.append(change)
            except Exception:
                errors += 1

        return RateUpdateResult(
            total_items=len(external_data),
            updated=len(changes),
            unchanged=len(external_data) - len(changes) - errors,
            errors=errors,
            changes=changes,
            summary={
                'source': 'External import',
                'rate_type': rate_type.value
            }
        )

    def apply_regional_factors(self,
                                region_factors: Dict[str, float],
                                default_factor: float = 1.0) -> RateUpdateResult:
        """Apply regional adjustment factors."""

        # This assumes region column exists or applies uniformly
        factor = region_factors.get('default', default_factor)

        labor_result = self.apply_percentage_adjustment(
            RateType.LABOR,
            (region_factors.get('labor', factor) - 1) * 100,
            reason="Regional adjustment"
        )

        material_result = self.apply_percentage_adjustment(
            RateType.MATERIAL,
            (region_factors.get('material', factor) - 1) * 100,
            reason="Regional adjustment"
        )

        equipment_result = self.apply_percentage_adjustment(
            RateType.EQUIPMENT,
            (region_factors.get('equipment', factor) - 1) * 100,
            reason="Regional adjustment"
        )

        all_changes = (labor_result.changes + material_result.changes +
                       equipment_result.changes)

        return RateUpdateResult(
            total_items=len(self.data),
            updated=len(all_changes),
            unchanged=len(self.data) * 3 - len(all_changes),
            errors=0,
            changes=all_changes,
            summary={
                'region_factors': region_factors,
                'labor_adjusted': len(labor_result.changes),
                'material_adjusted': len(material_result.changes),
                'equipment_adjusted': len(equipment_result.changes)
            }
        )

    def get_change_log(self,
                        start_date: datetime = None,
                        rate_type: RateType = None) -> List[RateChange]:
        """Get change log, optionally filtered."""

        changes = self.change_log

        if start_date:
            changes = [c for c in changes if c.change_date >= start_date]

        if rate_type:
            changes = [c for c in changes if c.rate_type == rate_type]

        return changes

    def export_change_log(self, output_path: str) -> str:
        """Export change log to Excel."""

        df = pd.DataFrame([
            {
                'Resource Code': c.resource_code,
                'Rate Type': c.rate_type.value,
                'Old Rate': c.old_rate,
                'New Rate': c.new_rate,
                'Change %': c.change_percent,
                'Date': c.change_date.strftime('%Y-%m-%d %H:%M'),
                'Reason': c.reason,
                'Source': c.source
            }
            for c in self.change_log
        ])

        df.to_excel(output_path, index=False)
        return output_path

    def rollback_changes(self,
                          since: datetime = None) -> int:
        """Rollback changes since date (returns to original data)."""

        if since is None:
            # Full rollback
            self.data = self.original_data.copy()
            count = len(self.change_log)
            self.change_log = []
            return count

        # Partial rollback - more complex, would need versioning
        return 0

    def export_updated_data(self, output_path: str) -> str:
        """Export updated CWICR data."""

        if output_path.endswith('.parquet'):
            self.data.to_parquet(output_path)
        else:
            self.data.to_excel(output_path, index=False)

        return output_path


class RateScheduler:
    """Schedule automatic rate updates."""

    def __init__(self, updater: CWICRRateUpdater):
        self.updater = updater
        self.schedules: List[Dict[str, Any]] = []

    def add_annual_labor_increase(self,
                                   percentage: float,
                                   effective_date: date) -> Dict[str, Any]:
        """Schedule annual labor rate increase."""

        schedule = {
            'id': len(self.schedules) + 1,
            'type': 'annual_labor',
            'percentage': percentage,
            'effective_date': effective_date,
            'rate_type': RateType.LABOR,
            'status': 'scheduled'
        }
        self.schedules.append(schedule)
        return schedule

    def execute_due_updates(self, current_date: date = None) -> List[RateUpdateResult]:
        """Execute all updates that are due."""

        if current_date is None:
            current_date = date.today()

        results = []

        for schedule in self.schedules:
            if schedule['status'] == 'scheduled' and schedule['effective_date'] <= current_date:
                result = self.updater.apply_percentage_adjustment(
                    rate_type=schedule['rate_type'],
                    percentage=schedule['percentage'],
                    reason=f"Scheduled {schedule['type']}"
                )
                schedule['status'] = 'executed'
                schedule['executed_date'] = current_date
                results.append(result)

        return results
```

## Quick Start

```python
# Load CWICR data
cwicr = pd.read_parquet("ddc_cwicr_en.parquet")

# Initialize updater
updater = CWICRRateUpdater(cwicr)

# Apply 5% labor rate increase
result = updater.apply_percentage_adjustment(
    rate_type=RateType.LABOR,
    percentage=5.0,
    reason="2024 Annual Increase"
)

print(f"Updated {result.updated} labor rates")
print(f"Average adjustment: {result.summary.get('adjustment_percent')}%")
```

## Common Use Cases

### 1. Inflation Adjustment
```python
inflation_rates = {
    2020: 0.012, 2021: 0.047, 2022: 0.065, 2023: 0.034
}
result = updater.apply_inflation_index(
    base_year=2020,
    current_year=2024,
    inflation_rates=inflation_rates
)
print(f"Cumulative adjustment: {result.summary['total_adjustment_percent']}%")
```

### 2. Regional Factors
```python
berlin_factors = {
    'labor': 1.15,
    'material': 0.95,
    'equipment': 1.05
}
result = updater.apply_regional_factors(berlin_factors)
```

### 3. Import External Prices
```python
market_prices = pd.read_excel("current_prices.xlsx")
result = updater.import_external_rates(
    external_data=market_prices,
    code_column='item_code',
    rate_column='price',
    rate_type=RateType.MATERIAL
)
```

### 4. Export Audit Trail
```python
updater.export_change_log("rate_changes_2024.xlsx")
```

## Resources
- **GitHub**: [OpenConstructionEstimate-Jens-CWICR](https://github.com/jens-construction/OpenConstructionEstimate-Jens-CWICR)
- **Jens Book**: Chapter 3.1 - Rate Management


---


# CWICR Report Generator

## Overview
Generate professional cost reports from CWICR calculations - executive summaries, detailed breakdowns, charts, and export to multiple formats.

## Python Implementation

```python
import pandas as pd
from typing import Dict, Any, List, Optional
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
import json


@dataclass
class ReportSection:
    """Report section content."""
    title: str
    content: str
    chart_type: Optional[str] = None
    chart_data: Optional[Dict] = None


@dataclass
class CostReport:
    """Complete cost report."""
    project_name: str
    generated_date: datetime
    total_cost: float
    currency: str
    sections: List[ReportSection]
    line_items: List[Dict]
    summary: Dict[str, Any]


class CWICRReportGenerator:
    """Generate cost estimation reports."""

    def __init__(self, project_name: str = "Project",
                 currency: str = "USD"):
        self.project_name = project_name
        self.currency = currency
        self.sections: List[ReportSection] = []
        self.line_items: List[Dict] = []

    def add_summary(self, summary_data: Dict[str, float]):
        """Add executive summary section."""

        content = f"""
        <div class="summary-box">
            <h3>Cost Summary</h3>
            <table class="summary-table">
                <tr><td>Labor</td><td class="amount">${summary_data.get('labor', 0):,.2f}</td></tr>
                <tr><td>Materials</td><td class="amount">${summary_data.get('material', 0):,.2f}</td></tr>
                <tr><td>Equipment</td><td class="amount">${summary_data.get('equipment', 0):,.2f}</td></tr>
                <tr><td>Overhead</td><td class="amount">${summary_data.get('overhead', 0):,.2f}</td></tr>
                <tr><td>Profit</td><td class="amount">${summary_data.get('profit', 0):,.2f}</td></tr>
                <tr class="total"><td>TOTAL</td><td class="amount">${summary_data.get('total', 0):,.2f}</td></tr>
            </table>
        </div>
        """

        self.sections.append(ReportSection(
            title="Executive Summary",
            content=content,
            chart_type="pie",
            chart_data={
                'labels': ['Labor', 'Materials', 'Equipment', 'Overhead', 'Profit'],
                'values': [
                    summary_data.get('labor', 0),
                    summary_data.get('material', 0),
                    summary_data.get('equipment', 0),
                    summary_data.get('overhead', 0),
                    summary_data.get('profit', 0)
                ]
            }
        ))

    def add_breakdown_by_category(self, breakdown: Dict[str, float]):
        """Add breakdown by category section."""

        rows = ""
        for category, cost in sorted(breakdown.items(), key=lambda x: -x[1]):
            rows += f"<tr><td>{category}</td><td class='amount'>${cost:,.2f}</td></tr>"

        content = f"""
        <table class="detail-table">
            <thead><tr><th>Category</th><th>Cost</th></tr></thead>
            <tbody>{rows}</tbody>
        </table>
        """

        self.sections.append(ReportSection(
            title="Cost by Category",
            content=content,
            chart_type="bar",
            chart_data={
                'labels': list(breakdown.keys()),
                'values': list(breakdown.values())
            }
        ))

    def add_line_items(self, items: List[Dict]):
        """Add detailed line items."""
        self.line_items = items

        rows = ""
        for item in items[:50]:  # Limit for report
            rows += f"""
            <tr>
                <td>{item.get('code', '')}</td>
                <td>{item.get('description', '')[:50]}</td>
                <td>{item.get('quantity', 0):,.2f}</td>
                <td>{item.get('unit', '')}</td>
                <td class="amount">${item.get('unit_price', 0):,.2f}</td>
                <td class="amount">${item.get('total', 0):,.2f}</td>
            </tr>
            """

        content = f"""
        <table class="line-items">
            <thead>
                <tr>
                    <th>Code</th>
                    <th>Description</th>
                    <th>Qty</th>
                    <th>Unit</th>
                    <th>Unit Price</th>
                    <th>Total</th>
                </tr>
            </thead>
            <tbody>{rows}</tbody>
        </table>
        """

        self.sections.append(ReportSection(
            title="Line Items",
            content=content
        ))

    def generate_html(self) -> str:
        """Generate HTML report."""

        sections_html = ""
        for section in self.sections:
            sections_html += f"""
            <section class="report-section">
                <h2>{section.title}</h2>
                {section.content}
            </section>
            """

        html = f"""
<!DOCTYPE html>
<html>
<head>
    <title>Cost Report - {self.project_name}</title>
    <style>
        body {{ font-family: 'Segoe UI', Arial, sans-serif; margin: 40px; background: #f5f5f5; }}
        .report-container {{ max-width: 1200px; margin: 0 auto; background: white; padding: 40px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }}
        h1 {{ color: #2c3e50; border-bottom: 3px solid #3498db; padding-bottom: 10px; }}
        h2 {{ color: #34495e; margin-top: 30px; }}
        .summary-box {{ background: #ecf0f1; padding: 20px; border-radius: 8px; }}
        table {{ width: 100%; border-collapse: collapse; margin: 20px 0; }}
        th, td {{ padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }}
        th {{ background: #3498db; color: white; }}
        .amount {{ text-align: right; font-family: monospace; }}
        .total {{ font-weight: bold; background: #f8f9fa; }}
        .line-items td {{ font-size: 0.9em; }}
        .meta {{ color: #7f8c8d; font-size: 0.9em; margin-bottom: 20px; }}
    </style>
</head>
<body>
    <div class="report-container">
        <h1>Cost Estimation Report</h1>
        <div class="meta">
            <p>Project: {self.project_name}</p>
            <p>Generated: {datetime.now().strftime('%Y-%m-%d %H:%M')}</p>
            <p>Currency: {self.currency}</p>
        </div>
        {sections_html}
        <footer style="margin-top: 40px; color: #95a5a6; text-align: center;">
            Generated by Jens CWICR | DataDrivenConstruction.io
        </footer>
    </div>
</body>
</html>
        """

        return html

    def save_html(self, output_path: str) -> str:
        """Save HTML report to file."""
        html = self.generate_html()
        with open(output_path, 'w', encoding='utf-8') as f:
            f.write(html)
        return output_path

    def generate_excel(self, output_path: str) -> str:
        """Generate Excel report."""

        with pd.ExcelWriter(output_path, engine='openpyxl') as writer:
            # Summary sheet
            if self.sections:
                summary_data = []
                for section in self.sections:
                    if section.chart_data:
                        for i, label in enumerate(section.chart_data.get('labels', [])):
                            summary_data.append({
                                'Category': label,
                                'Amount': section.chart_data.get('values', [])[i]
                            })
                if summary_data:
                    pd.DataFrame(summary_data).to_excel(
                        writer, sheet_name='Summary', index=False)

            # Line items sheet
            if self.line_items:
                pd.DataFrame(self.line_items).to_excel(
                    writer, sheet_name='Line Items', index=False)

        return output_path

    def generate_json(self) -> str:
        """Generate JSON report."""

        report = {
            'project_name': self.project_name,
            'generated_date': datetime.now().isoformat(),
            'currency': self.currency,
            'sections': [
                {
                    'title': s.title,
                    'chart_data': s.chart_data
                } for s in self.sections
            ],
            'line_items': self.line_items
        }

        return json.dumps(report, indent=2)


class QuickReport:
    """Quick report generation from cost data."""

    @staticmethod
    def from_dataframe(df: pd.DataFrame,
                       project_name: str = "Project") -> CWICRReportGenerator:
        """Generate report from cost DataFrame."""

        gen = CWICRReportGenerator(project_name)

        # Calculate summary
        summary = {
            'labor': df['labor_cost'].sum() if 'labor_cost' in df.columns else 0,
            'material': df['material_cost'].sum() if 'material_cost' in df.columns else 0,
            'equipment': df['equipment_cost'].sum() if 'equipment_cost' in df.columns else 0,
            'overhead': df['overhead_cost'].sum() if 'overhead_cost' in df.columns else 0,
            'profit': df['profit_cost'].sum() if 'profit_cost' in df.columns else 0,
            'total': df['total_cost'].sum() if 'total_cost' in df.columns else 0
        }
        gen.add_summary(summary)

        # Category breakdown
        if 'category' in df.columns and 'total_cost' in df.columns:
            breakdown = df.groupby('category')['total_cost'].sum().to_dict()
            gen.add_breakdown_by_category(breakdown)

        # Line items
        items = df.to_dict('records')
        gen.add_line_items(items)

        return gen
```

## Quick Start

```python
# Create report generator
gen = CWICRReportGenerator("Office Building", currency="EUR")

# Add sections
gen.add_summary({
    'labor': 125000,
    'material': 350000,
    'equipment': 75000,
    'overhead': 82500,
    'profit': 63250,
    'total': 695750
})

# Save reports
gen.save_html("cost_report.html")
gen.generate_excel("cost_report.xlsx")
```

## From DataFrame

```python
# Quick report from cost DataFrame
report = QuickReport.from_dataframe(cost_df, "My Project")
report.save_html("quick_report.html")
```

## Resources
- **Jens Book**: Chapter 4.2 - ETL Load Reports


---


# CWICR Resource Analyzer

## Business Case

### Problem Statement
Construction projects require precise resource planning:
- How many labor hours are needed?
- What materials need to be procured?
- What equipment is required and for how long?

Traditional methods rely on experience-based estimates, leading to over/under allocation.

### Solution
Data-driven resource analysis using CWICR's 27,672 resources with detailed breakdowns of labor norms, material requirements, and equipment usage.

### Business Value
- **Accurate planning** - Based on validated resource norms
- **Cost optimization** - Identify resource inefficiencies
- **Procurement support** - Generate material lists
- **Labor planning** - Calculate crew requirements

## Technical Implementation

### Python Implementation

```python
import pandas as pd
import numpy as np
from typing import Dict, Any, List, Optional, Tuple
from dataclasses import dataclass, field
from enum import Enum
from collections import defaultdict


class ResourceType(Enum):
    """Types of construction resources."""
    LABOR = "labor"
    MATERIAL = "material"
    EQUIPMENT = "equipment"
    SUBCONTRACT = "subcontract"


class LaborCategory(Enum):
    """Labor skill categories."""
    UNSKILLED = "unskilled"
    SEMI_SKILLED = "semi_skilled"
    SKILLED = "skilled"
    FOREMAN = "foreman"
    SUPERVISOR = "supervisor"
    SPECIALIST = "specialist"


class EquipmentCategory(Enum):
    """Equipment categories."""
    EARTHMOVING = "earthmoving"
    LIFTING = "lifting"
    CONCRETE = "concrete"
    TRANSPORT = "transport"
    COMPACTION = "compaction"
    PUMPING = "pumping"
    POWER_TOOLS = "power_tools"
    SCAFFOLDING = "scaffolding"


@dataclass
class LaborResource:
    """Represents a labor resource."""
    resource_code: str
    description: str
    category: LaborCategory
    hourly_rate: float
    skill_level: int
    productivity_factor: float = 1.0


@dataclass
class MaterialResource:
    """Represents a material resource."""
    resource_code: str
    description: str
    unit: str
    unit_price: float
    category: str
    waste_factor: float = 0.05  # 5% default waste


@dataclass
class EquipmentResource:
    """Represents an equipment resource."""
    resource_code: str
    description: str
    category: EquipmentCategory
    hourly_rate: float
    daily_rate: float
    monthly_rate: float
    fuel_consumption: float = 0.0  # liters per hour
    operator_required: bool = True


@dataclass
class ResourceRequirement:
    """Calculated resource requirement."""
    resource_code: str
    description: str
    resource_type: ResourceType
    quantity: float
    unit: str
    unit_cost: float
    total_cost: float
    duration_hours: float = 0.0


@dataclass
class ResourceSummary:
    """Summary of all resource requirements."""
    labor_hours: float
    labor_cost: float
    material_cost: float
    equipment_cost: float
    total_cost: float

    labor_by_category: Dict[str, float] = field(default_factory=dict)
    materials_list: List[Dict[str, Any]] = field(default_factory=list)
    equipment_list: List[Dict[str, Any]] = field(default_factory=list)


class CWICRResourceAnalyzer:
    """Analyze resources from CWICR database."""

    def __init__(self, cwicr_data: pd.DataFrame,
                 resources_data: Optional[pd.DataFrame] = None):
        self.work_items = cwicr_data
        self.resources = resources_data

        # Create indexes
        self._index_work_items()
        if resources_data is not None:
            self._index_resources()

    def _index_work_items(self):
        """Index work items for fast lookup."""
        if 'work_item_code' in self.work_items.columns:
            self._work_index = self.work_items.set_index('work_item_code')
        else:
            self._work_index = None

    def _index_resources(self):
        """Index resources for fast lookup."""
        if self.resources is not None and 'resource_code' in self.resources.columns:
            self._resource_index = self.resources.set_index('resource_code')
        else:
            self._resource_index = None

    def analyze_labor_requirements(self, items: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Analyze labor requirements for work items."""

        total_hours = 0.0
        labor_by_category = defaultdict(float)
        labor_by_skill = defaultdict(float)
        labor_details = []

        for item in items:
            code = item.get('work_item_code', item.get('code'))
            qty = item.get('quantity', 0)

            if self._work_index is not None and code in self._work_index.index:
                work_item = self._work_index.loc[code]
                labor_norm = float(work_item.get('labor_norm', 0) or 0)
                hours = labor_norm * qty

                total_hours += hours

                # Get category if available
                category = str(work_item.get('category', 'General'))
                labor_by_category[category] += hours

                labor_details.append({
                    'work_item_code': code,
                    'description': work_item.get('description', ''),
                    'quantity': qty,
                    'labor_norm': labor_norm,
                    'total_hours': hours
                })

        return {
            'total_labor_hours': round(total_hours, 2),
            'labor_by_category': dict(labor_by_category),
            'crew_days_8hr': round(total_hours / 8, 1),
            'crew_weeks_40hr': round(total_hours / 40, 1),
            'details': labor_details
        }

    def analyze_material_requirements(self, items: List[Dict[str, Any]],
                                       include_waste: bool = True) -> Dict[str, Any]:
        """Analyze material requirements."""

        materials = defaultdict(lambda: {'quantity': 0, 'unit': '', 'cost': 0})
        total_cost = 0.0

        for item in items:
            code = item.get('work_item_code', item.get('code'))
            qty = item.get('quantity', 0)

            if self._work_index is not None and code in self._work_index.index:
                work_item = self._work_index.loc[code]
                material_cost = float(work_item.get('material_cost', 0) or 0) * qty

                if include_waste:
                    material_cost *= 1.05  # 5% waste factor

                total_cost += material_cost

                # Aggregate by category
                category = str(work_item.get('category', 'General'))
                materials[category]['cost'] += material_cost

        return {
            'total_material_cost': round(total_cost, 2),
            'by_category': dict(materials),
            'waste_included': include_waste,
            'waste_factor': 0.05 if include_waste else 0
        }

    def analyze_equipment_requirements(self, items: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Analyze equipment requirements."""

        equipment_hours = defaultdict(float)
        total_cost = 0.0

        for item in items:
            code = item.get('work_item_code', item.get('code'))
            qty = item.get('quantity', 0)

            if self._work_index is not None and code in self._work_index.index:
                work_item = self._work_index.loc[code]
                equipment_cost = float(work_item.get('equipment_cost', 0) or 0) * qty
                equipment_norm = float(work_item.get('equipment_norm', 0) or 0) * qty

                total_cost += equipment_cost

                category = str(work_item.get('category', 'General'))
                equipment_hours[category] += equipment_norm

        return {
            'total_equipment_cost': round(total_cost, 2),
            'equipment_hours_by_category': dict(equipment_hours),
            'total_equipment_hours': sum(equipment_hours.values())
        }

    def generate_resource_summary(self, items: List[Dict[str, Any]]) -> ResourceSummary:
        """Generate complete resource summary."""

        labor = self.analyze_labor_requirements(items)
        materials = self.analyze_material_requirements(items)
        equipment = self.analyze_equipment_requirements(items)

        # Calculate labor cost
        avg_labor_rate = 35.0  # Default hourly rate
        labor_cost = labor['total_labor_hours'] * avg_labor_rate

        return ResourceSummary(
            labor_hours=labor['total_labor_hours'],
            labor_cost=labor_cost,
            material_cost=materials['total_material_cost'],
            equipment_cost=equipment['total_equipment_cost'],
            total_cost=labor_cost + materials['total_material_cost'] + equipment['total_equipment_cost'],
            labor_by_category=labor['labor_by_category']
        )

    def calculate_crew_requirements(self, labor_hours: float,
                                     project_duration_days: int,
                                     hours_per_day: int = 8) -> Dict[str, Any]:
        """Calculate crew size requirements."""

        available_hours = project_duration_days * hours_per_day
        min_crew_size = labor_hours / available_hours if available_hours > 0 else 0

        return {
            'total_labor_hours': labor_hours,
            'project_duration_days': project_duration_days,
            'hours_per_day': hours_per_day,
            'minimum_crew_size': round(min_crew_size, 1),
            'recommended_crew_size': int(np.ceil(min_crew_size * 1.15)),  # 15% buffer
            'utilization_at_recommended': round(min_crew_size / np.ceil(min_crew_size * 1.15) * 100, 1)
        }

    def identify_critical_resources(self, items: List[Dict[str, Any]],
                                     top_n: int = 10) -> Dict[str, List[Dict]]:
        """Identify critical resources by cost impact."""

        breakdowns = []
        for item in items:
            code = item.get('work_item_code', item.get('code'))
            qty = item.get('quantity', 0)

            if self._work_index is not None and code in self._work_index.index:
                work_item = self._work_index.loc[code]

                breakdowns.append({
                    'work_item_code': code,
                    'description': work_item.get('description', ''),
                    'quantity': qty,
                    'labor_cost': float(work_item.get('labor_cost', 0) or 0) * qty,
                    'material_cost': float(work_item.get('material_cost', 0) or 0) * qty,
                    'equipment_cost': float(work_item.get('equipment_cost', 0) or 0) * qty,
                    'total_cost': (
                        float(work_item.get('labor_cost', 0) or 0) +
                        float(work_item.get('material_cost', 0) or 0) +
                        float(work_item.get('equipment_cost', 0) or 0)
                    ) * qty
                })

        df = pd.DataFrame(breakdowns)
        if df.empty:
            return {'labor': [], 'material': [], 'equipment': [], 'total': []}

        return {
            'labor': df.nlargest(top_n, 'labor_cost')[['work_item_code', 'description', 'labor_cost']].to_dict('records'),
            'material': df.nlargest(top_n, 'material_cost')[['work_item_code', 'description', 'material_cost']].to_dict('records'),
            'equipment': df.nlargest(top_n, 'equipment_cost')[['work_item_code', 'description', 'equipment_cost']].to_dict('records'),
            'total': df.nlargest(top_n, 'total_cost')[['work_item_code', 'description', 'total_cost']].to_dict('records')
        }

    def analyze_productivity(self, items: List[Dict[str, Any]],
                             actual_hours: Optional[Dict[str, float]] = None) -> Dict[str, Any]:
        """Analyze productivity vs planned norms."""

        if actual_hours is None:
            return {'error': 'Actual hours required for productivity analysis'}

        analysis = []
        for item in items:
            code = item.get('work_item_code', item.get('code'))
            qty = item.get('quantity', 0)

            if code in actual_hours and self._work_index is not None:
                if code in self._work_index.index:
                    work_item = self._work_index.loc[code]
                    planned_hours = float(work_item.get('labor_norm', 0) or 0) * qty
                    actual = actual_hours[code]

                    productivity = planned_hours / actual * 100 if actual > 0 else 0

                    analysis.append({
                        'work_item_code': code,
                        'planned_hours': planned_hours,
                        'actual_hours': actual,
                        'productivity_percent': round(productivity, 1),
                        'variance_hours': planned_hours - actual
                    })

        df = pd.DataFrame(analysis)
        if df.empty:
            return {'items': [], 'average_productivity': 0}

        return {
            'items': analysis,
            'average_productivity': round(df['productivity_percent'].mean(), 1),
            'total_variance': round(df['variance_hours'].sum(), 1),
            'underperforming_items': len(df[df['productivity_percent'] < 90])
        }


class ResourceOptimizer:
    """Optimize resource allocation."""

    def __init__(self, analyzer: CWICRResourceAnalyzer):
        self.analyzer = analyzer

    def suggest_material_substitutions(self, items: List[Dict[str, Any]],
                                        cost_threshold: float = 0.9) -> List[Dict]:
        """Suggest cheaper material substitutions."""
        # Placeholder for substitution logic
        return []

    def optimize_crew_allocation(self, labor_by_category: Dict[str, float],
                                  available_crew: Dict[str, int]) -> Dict[str, Any]:
        """Optimize crew allocation across categories."""

        allocation = {}
        unmet_demand = {}

        for category, hours_needed in labor_by_category.items():
            available = available_crew.get(category, 0)
            days_needed = hours_needed / 8

            if available > 0:
                days_available = available * 1  # 1 day per person
                if days_available >= days_needed:
                    allocation[category] = {
                        'assigned': int(np.ceil(days_needed)),
                        'remaining': available - int(np.ceil(days_needed))
                    }
                else:
                    allocation[category] = {'assigned': available, 'remaining': 0}
                    unmet_demand[category] = days_needed - days_available
            else:
                unmet_demand[category] = days_needed

        return {
            'allocation': allocation,
            'unmet_demand': unmet_demand,
            'fully_staffed': len(unmet_demand) == 0
        }
```

## Quick Start

```python
from cwicr_data_loader import CWICRDataLoader

# Load data
loader = CWICRDataLoader()
cwicr = loader.load("ddc_cwicr_en.parquet")

# Initialize analyzer
analyzer = CWICRResourceAnalyzer(cwicr)

# Define project items
items = [
    {'work_item_code': 'CONC-001', 'quantity': 150},
    {'work_item_code': 'EXCV-002', 'quantity': 200},
    {'work_item_code': 'REBAR-003', 'quantity': 15000}
]

# Analyze labor
labor = analyzer.analyze_labor_requirements(items)
print(f"Total Labor Hours: {labor['total_labor_hours']}")
print(f"Crew Days (8hr): {labor['crew_days_8hr']}")
```

## Common Use Cases

### 1. Crew Planning
```python
# Calculate required crew size
labor = analyzer.analyze_labor_requirements(items)
crew = analyzer.calculate_crew_requirements(
    labor_hours=labor['total_labor_hours'],
    project_duration_days=30
)
print(f"Minimum Crew: {crew['minimum_crew_size']}")
print(f"Recommended Crew: {crew['recommended_crew_size']}")
```

### 2. Material Procurement
```python
materials = analyzer.analyze_material_requirements(items, include_waste=True)
print(f"Total Material Cost: ${materials['total_material_cost']:,.2f}")
```

### 3. Productivity Tracking
```python
actual_hours = {
    'CONC-001': 280,
    'EXCV-002': 85,
    'REBAR-003': 450
}
productivity = analyzer.analyze_productivity(items, actual_hours)
print(f"Average Productivity: {productivity['average_productivity']}%")
```

## Resources

- **GitHub**: [OpenConstructionEstimate-Jens-CWICR](https://github.com/jens-construction/OpenConstructionEstimate-Jens-CWICR)
- **Jens Book**: Chapter 3.1 - Resource-Based Cost Estimation


---


# CWICR Risk Calculator

## Business Case

### Problem Statement
Cost estimates have inherent uncertainty:
- What contingency to apply?
- What is the confidence range?
- Which items have highest risk?
- How to quantify uncertainty?

### Solution
Risk-adjusted cost calculations using contingency analysis, Monte Carlo simulation, and probability distributions based on CWICR cost data.

### Business Value
- **Informed decisions** - Understand estimate uncertainty
- **Appropriate contingency** - Data-driven risk allowance
- **Confidence intervals** - P50, P80, P90 estimates
- **Risk prioritization** - Focus on high-impact items

## Technical Implementation

```python
import pandas as pd
import numpy as np
from typing import Dict, Any, List, Optional, Tuple
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
import random


class RiskLevel(Enum):
    """Risk level categories."""
    LOW = "low"         # Well-defined, standard work
    MEDIUM = "medium"   # Some uncertainty
    HIGH = "high"       # Significant uncertainty
    VERY_HIGH = "very_high"  # Major unknowns


class DistributionType(Enum):
    """Probability distribution types."""
    NORMAL = "normal"
    TRIANGULAR = "triangular"
    UNIFORM = "uniform"
    PERT = "pert"
    LOGNORMAL = "lognormal"


@dataclass
class RiskParameters:
    """Risk parameters for a work item."""
    work_item_code: str
    base_cost: float
    risk_level: RiskLevel
    distribution: DistributionType
    min_factor: float  # Multiplier for minimum
    max_factor: float  # Multiplier for maximum
    most_likely_factor: float = 1.0


@dataclass
class MonteCarloResult:
    """Results of Monte Carlo simulation."""
    iterations: int
    mean: float
    std_dev: float
    p10: float  # 10th percentile
    p50: float  # Median
    p80: float  # 80th percentile
    p90: float  # 90th percentile
    min_value: float
    max_value: float
    values: List[float]


@dataclass
class RiskAnalysisResult:
    """Complete risk analysis result."""
    base_estimate: float
    risk_adjusted_mean: float
    contingency_amount: float
    contingency_percent: float
    p50_estimate: float
    p80_estimate: float
    p90_estimate: float
    high_risk_items: List[Dict[str, Any]]
    item_risks: List[RiskParameters]
    monte_carlo: Optional[MonteCarloResult] = None


# Default risk parameters by category
DEFAULT_RISK_PARAMS = {
    'CONC': {'risk': RiskLevel.LOW, 'min': 0.95, 'max': 1.15},
    'EXCV': {'risk': RiskLevel.MEDIUM, 'min': 0.85, 'max': 1.30},
    'STRL': {'risk': RiskLevel.LOW, 'min': 0.95, 'max': 1.10},
    'MECH': {'risk': RiskLevel.MEDIUM, 'min': 0.90, 'max': 1.25},
    'ELEC': {'risk': RiskLevel.MEDIUM, 'min': 0.90, 'max': 1.20},
    'FINI': {'risk': RiskLevel.HIGH, 'min': 0.85, 'max': 1.40},
    'SITE': {'risk': RiskLevel.HIGH, 'min': 0.80, 'max': 1.50},
    'DEFAULT': {'risk': RiskLevel.MEDIUM, 'min': 0.90, 'max': 1.25}
}


class CWICRRiskCalculator:
    """Calculate risk-adjusted estimates using CWICR data."""

    def __init__(self, cwicr_data: pd.DataFrame):
        self.work_items = cwicr_data
        self._index_data()

    def _index_data(self):
        """Index work items."""
        if 'work_item_code' in self.work_items.columns:
            self._code_index = self.work_items.set_index('work_item_code')
        else:
            self._code_index = None

    def _get_risk_params(self, code: str) -> Dict[str, Any]:
        """Get default risk parameters for work item code."""
        prefix = code.split('-')[0] if '-' in code else code[:4]

        return DEFAULT_RISK_PARAMS.get(prefix, DEFAULT_RISK_PARAMS['DEFAULT'])

    def define_item_risk(self,
                          code: str,
                          base_cost: float,
                          risk_level: RiskLevel = None,
                          distribution: DistributionType = DistributionType.TRIANGULAR,
                          min_factor: float = None,
                          max_factor: float = None) -> RiskParameters:
        """Define risk parameters for a work item."""

        default_params = self._get_risk_params(code)

        if risk_level is None:
            risk_level = default_params['risk']
        if min_factor is None:
            min_factor = default_params['min']
        if max_factor is None:
            max_factor = default_params['max']

        return RiskParameters(
            work_item_code=code,
            base_cost=base_cost,
            risk_level=risk_level,
            distribution=distribution,
            min_factor=min_factor,
            max_factor=max_factor,
            most_likely_factor=1.0
        )

    def calculate_item_risk(self,
                             items: List[Dict[str, Any]]) -> List[RiskParameters]:
        """Calculate risk parameters for list of work items."""

        risk_params = []

        for item in items:
            code = item.get('work_item_code', item.get('code'))
            qty = item.get('quantity', 0)

            # Get base cost
            base_cost = 0
            if self._code_index is not None and code in self._code_index.index:
                wi = self._code_index.loc[code]
                labor = float(wi.get('labor_cost', 0) or 0)
                material = float(wi.get('material_cost', 0) or 0)
                equipment = float(wi.get('equipment_cost', 0) or 0)
                base_cost = (labor + material + equipment) * qty

            # Get risk level from item or default
            risk_level = item.get('risk_level')
            if risk_level and isinstance(risk_level, str):
                risk_level = RiskLevel[risk_level.upper()]

            params = self.define_item_risk(
                code=code,
                base_cost=base_cost,
                risk_level=risk_level,
                min_factor=item.get('min_factor'),
                max_factor=item.get('max_factor')
            )
            risk_params.append(params)

        return risk_params

    def _sample_distribution(self, params: RiskParameters) -> float:
        """Sample from probability distribution."""

        min_cost = params.base_cost * params.min_factor
        max_cost = params.base_cost * params.max_factor
        mode_cost = params.base_cost * params.most_likely_factor

        if params.distribution == DistributionType.TRIANGULAR:
            return np.random.triangular(min_cost, mode_cost, max_cost)

        elif params.distribution == DistributionType.UNIFORM:
            return np.random.uniform(min_cost, max_cost)

        elif params.distribution == DistributionType.NORMAL:
            mean = params.base_cost
            std = (max_cost - min_cost) / 6  # 99.7% within range
            return max(min_cost, min(max_cost, np.random.normal(mean, std)))

        elif params.distribution == DistributionType.PERT:
            # PERT/Beta distribution
            mean = (min_cost + 4 * mode_cost + max_cost) / 6
            std = (max_cost - min_cost) / 6
            return max(min_cost, min(max_cost, np.random.normal(mean, std)))

        elif params.distribution == DistributionType.LOGNORMAL:
            # Lognormal for skewed risks
            log_mean = np.log(params.base_cost)
            log_std = 0.1 * (params.max_factor - params.min_factor)
            return np.random.lognormal(log_mean, log_std)

        return params.base_cost

    def run_monte_carlo(self,
                         risk_params: List[RiskParameters],
                         iterations: int = 10000) -> MonteCarloResult:
        """Run Monte Carlo simulation."""

        total_costs = []

        for _ in range(iterations):
            iteration_total = sum(
                self._sample_distribution(params)
                for params in risk_params
            )
            total_costs.append(iteration_total)

        total_costs = np.array(total_costs)

        return MonteCarloResult(
            iterations=iterations,
            mean=round(float(np.mean(total_costs)), 2),
            std_dev=round(float(np.std(total_costs)), 2),
            p10=round(float(np.percentile(total_costs, 10)), 2),
            p50=round(float(np.percentile(total_costs, 50)), 2),
            p80=round(float(np.percentile(total_costs, 80)), 2),
            p90=round(float(np.percentile(total_costs, 90)), 2),
            min_value=round(float(np.min(total_costs)), 2),
            max_value=round(float(np.max(total_costs)), 2),
            values=list(total_costs)
        )

    def analyze_risk(self,
                      items: List[Dict[str, Any]],
                      run_simulation: bool = True,
                      iterations: int = 10000) -> RiskAnalysisResult:
        """Complete risk analysis of estimate."""

        risk_params = self.calculate_item_risk(items)

        # Base estimate
        base_estimate = sum(p.base_cost for p in risk_params)

        # Run Monte Carlo if requested
        monte_carlo = None
        if run_simulation:
            monte_carlo = self.run_monte_carlo(risk_params, iterations)
            risk_adjusted_mean = monte_carlo.mean
            p50 = monte_carlo.p50
            p80 = monte_carlo.p80
            p90 = monte_carlo.p90
        else:
            # Deterministic calculation
            risk_adjusted_mean = sum(
                p.base_cost * (p.min_factor + 4 * p.most_likely_factor + p.max_factor) / 6
                for p in risk_params
            )
            p50 = risk_adjusted_mean
            p80 = sum(
                p.base_cost * (p.min_factor + p.max_factor * 3) / 4
                for p in risk_params
            )
            p90 = sum(p.base_cost * p.max_factor * 0.9 for p in risk_params)

        contingency = p80 - base_estimate
        contingency_pct = (contingency / base_estimate * 100) if base_estimate > 0 else 0

        # Identify high risk items
        high_risk_items = [
            {
                'code': p.work_item_code,
                'base_cost': p.base_cost,
                'risk_level': p.risk_level.value,
                'range': f"{p.min_factor:.0%} - {p.max_factor:.0%}",
                'risk_exposure': p.base_cost * (p.max_factor - 1)
            }
            for p in risk_params
            if p.risk_level in [RiskLevel.HIGH, RiskLevel.VERY_HIGH]
        ]

        return RiskAnalysisResult(
            base_estimate=round(base_estimate, 2),
            risk_adjusted_mean=round(risk_adjusted_mean, 2),
            contingency_amount=round(contingency, 2),
            contingency_percent=round(contingency_pct, 1),
            p50_estimate=round(p50, 2),
            p80_estimate=round(p80, 2),
            p90_estimate=round(p90, 2),
            high_risk_items=sorted(high_risk_items, key=lambda x: x['risk_exposure'], reverse=True),
            item_risks=risk_params,
            monte_carlo=monte_carlo
        )

    def calculate_contingency(self,
                               base_estimate: float,
                               project_phase: str = 'detailed',
                               complexity: str = 'medium') -> Dict[str, Any]:
        """Calculate recommended contingency based on project phase."""

        # Standard contingency ranges by phase
        contingency_ranges = {
            'concept': {'low': 0.25, 'medium': 0.35, 'high': 0.50},
            'schematic': {'low': 0.15, 'medium': 0.25, 'high': 0.35},
            'detailed': {'low': 0.08, 'medium': 0.12, 'high': 0.18},
            'construction': {'low': 0.03, 'medium': 0.05, 'high': 0.08}
        }

        phase_range = contingency_ranges.get(project_phase, contingency_ranges['detailed'])
        rate = phase_range.get(complexity, phase_range['medium'])

        return {
            'base_estimate': base_estimate,
            'contingency_rate': f"{rate:.0%}",
            'contingency_amount': round(base_estimate * rate, 2),
            'total_with_contingency': round(base_estimate * (1 + rate), 2),
            'project_phase': project_phase,
            'complexity': complexity
        }

    def sensitivity_analysis(self,
                              risk_params: List[RiskParameters],
                              base_result: MonteCarloResult) -> pd.DataFrame:
        """Analyze sensitivity of total cost to each item."""

        sensitivities = []

        for param in risk_params:
            # Calculate contribution to variance
            item_variance = (param.base_cost * (param.max_factor - param.min_factor) / 6) ** 2
            total_variance = base_result.std_dev ** 2

            contribution_pct = (item_variance / total_variance * 100) if total_variance > 0 else 0

            sensitivities.append({
                'work_item_code': param.work_item_code,
                'base_cost': param.base_cost,
                'risk_level': param.risk_level.value,
                'variance_contribution_pct': round(contribution_pct, 1),
                'cost_range_low': round(param.base_cost * param.min_factor, 2),
                'cost_range_high': round(param.base_cost * param.max_factor, 2)
            })

        return pd.DataFrame(sensitivities).sort_values('variance_contribution_pct', ascending=False)

    def export_analysis(self,
                         result: RiskAnalysisResult,
                         output_path: str) -> str:
        """Export risk analysis to Excel."""

        with pd.ExcelWriter(output_path, engine='openpyxl') as writer:
            # Summary
            summary_df = pd.DataFrame([{
                'Base Estimate': result.base_estimate,
                'Risk Adjusted Mean': result.risk_adjusted_mean,
                'Contingency Amount': result.contingency_amount,
                'Contingency %': result.contingency_percent,
                'P50 Estimate': result.p50_estimate,
                'P80 Estimate': result.p80_estimate,
                'P90 Estimate': result.p90_estimate
            }])
            summary_df.to_excel(writer, sheet_name='Summary', index=False)

            # Item Risks
            items_df = pd.DataFrame([
                {
                    'Work Item': p.work_item_code,
                    'Base Cost': p.base_cost,
                    'Risk Level': p.risk_level.value,
                    'Min Factor': p.min_factor,
                    'Max Factor': p.max_factor,
                    'Distribution': p.distribution.value
                }
                for p in result.item_risks
            ])
            items_df.to_excel(writer, sheet_name='Item Risks', index=False)

            # High Risk Items
            if result.high_risk_items:
                high_risk_df = pd.DataFrame(result.high_risk_items)
                high_risk_df.to_excel(writer, sheet_name='High Risk', index=False)

            # Monte Carlo distribution (sample)
            if result.monte_carlo and result.monte_carlo.values:
                mc_df = pd.DataFrame({
                    'Iteration': range(1, min(1001, len(result.monte_carlo.values) + 1)),
                    'Total Cost': result.monte_carlo.values[:1000]
                })
                mc_df.to_excel(writer, sheet_name='Monte Carlo', index=False)

        return output_path
```

## Quick Start

```python
# Load CWICR data
cwicr = pd.read_parquet("ddc_cwicr_en.parquet")

# Initialize risk calculator
risk_calc = CWICRRiskCalculator(cwicr)

# Define work items
items = [
    {'work_item_code': 'CONC-001', 'quantity': 150},
    {'work_item_code': 'EXCV-002', 'quantity': 500, 'risk_level': 'high'},
    {'work_item_code': 'STRL-003', 'quantity': 25}
]

# Run risk analysis
result = risk_calc.analyze_risk(items, iterations=10000)

print(f"Base Estimate: ${result.base_estimate:,.2f}")
print(f"P50: ${result.p50_estimate:,.2f}")
print(f"P80: ${result.p80_estimate:,.2f}")
print(f"P90: ${result.p90_estimate:,.2f}")
print(f"Recommended Contingency: {result.contingency_percent}%")
```

## Common Use Cases

### 1. Phase-Based Contingency
```python
contingency = risk_calc.calculate_contingency(
    base_estimate=1000000,
    project_phase='schematic',
    complexity='high'
)
print(f"Contingency: ${contingency['contingency_amount']:,.2f}")
```

### 2. Sensitivity Analysis
```python
sensitivity = risk_calc.sensitivity_analysis(
    result.item_risks,
    result.monte_carlo
)
print(sensitivity.head(5))
```

### 3. Export Report
```python
risk_calc.export_analysis(result, "risk_analysis.xlsx")
```

## Resources
- **GitHub**: [OpenConstructionEstimate-Jens-CWICR](https://github.com/jens-construction/OpenConstructionEstimate-Jens-CWICR)
- **Jens Book**: Chapter 3.1 - Risk-Based Estimating


---


# CWICR Schedule Integrator

## Business Case

### Problem Statement
Project planning requires:
- Linking costs to schedule activities
- Generating cost-loaded schedules
- Projecting cash flow requirements
- Tracking earned value

### Solution
Integrate CWICR cost data with project schedules to create cost-loaded Gantt charts, cash flow curves, and earned value tracking.

### Business Value
- **Cost visibility** - See when costs occur
- **Cash flow** - Project funding requirements
- **Earned value** - Track cost/schedule performance
- **Integration** - Connect cost and schedule data

## Technical Implementation

```python
import pandas as pd
import numpy as np
from typing import Dict, Any, List, Optional, Tuple
from dataclasses import dataclass, field
from datetime import datetime, timedelta, date
from enum import Enum
from collections import defaultdict


class CostDistribution(Enum):
    """Methods for distributing costs over time."""
    UNIFORM = "uniform"          # Even distribution
    FRONT_LOADED = "front_loaded"  # More at start
    BACK_LOADED = "back_loaded"    # More at end
    S_CURVE = "s_curve"          # S-curve distribution


@dataclass
class ScheduleActivity:
    """Project schedule activity."""
    activity_id: str
    description: str
    start_date: date
    end_date: date
    duration_days: int
    work_items: List[str]
    budgeted_cost: float
    predecessors: List[str] = field(default_factory=list)


@dataclass
class CostLoadedActivity:
    """Activity with daily cost distribution."""
    activity: ScheduleActivity
    daily_costs: Dict[date, float]
    cumulative_costs: Dict[date, float]


@dataclass
class CashFlowProjection:
    """Cash flow projection."""
    project_name: str
    start_date: date
    end_date: date
    total_cost: float
    daily_costs: Dict[date, float]
    weekly_costs: Dict[str, float]
    monthly_costs: Dict[str, float]
    cumulative: Dict[date, float]


@dataclass
class EarnedValueMetrics:
    """Earned value metrics at point in time."""
    data_date: date
    planned_value: float  # PV / BCWS
    earned_value: float   # EV / BCWP
    actual_cost: float    # AC / ACWP
    schedule_variance: float  # SV = EV - PV
    cost_variance: float      # CV = EV - AC
    spi: float               # Schedule Performance Index
    cpi: float               # Cost Performance Index
    eac: float               # Estimate at Completion
    etc: float               # Estimate to Complete


class CWICRScheduleIntegrator:
    """Integrate CWICR costs with project schedules."""

    def __init__(self, cwicr_data: pd.DataFrame):
        self.cost_data = cwicr_data
        self._index_data()

    def _index_data(self):
        """Index cost data."""
        if 'work_item_code' in self.cost_data.columns:
            self._code_index = self.cost_data.set_index('work_item_code')
        else:
            self._code_index = None

    def get_work_item_cost(self, code: str, quantity: float) -> float:
        """Get total cost for work item."""
        if self._code_index is None or code not in self._code_index.index:
            return 0

        item = self._code_index.loc[code]
        labor = float(item.get('labor_cost', 0) or 0)
        material = float(item.get('material_cost', 0) or 0)
        equipment = float(item.get('equipment_cost', 0) or 0)

        return (labor + material + equipment) * quantity

    def create_schedule_activity(self,
                                  activity_id: str,
                                  description: str,
                                  start_date: date,
                                  duration_days: int,
                                  work_items: List[Dict[str, Any]],
                                  predecessors: List[str] = None) -> ScheduleActivity:
        """Create schedule activity with linked work items."""

        # Calculate budgeted cost
        total_cost = 0
        codes = []
        for item in work_items:
            code = item.get('work_item_code', item.get('code'))
            qty = item.get('quantity', 0)
            total_cost += self.get_work_item_cost(code, qty)
            codes.append(code)

        end_date = start_date + timedelta(days=duration_days)

        return ScheduleActivity(
            activity_id=activity_id,
            description=description,
            start_date=start_date,
            end_date=end_date,
            duration_days=duration_days,
            work_items=codes,
            budgeted_cost=round(total_cost, 2),
            predecessors=predecessors or []
        )

    def distribute_cost(self,
                        activity: ScheduleActivity,
                        method: CostDistribution = CostDistribution.UNIFORM) -> CostLoadedActivity:
        """Distribute activity cost over duration."""

        daily_costs = {}
        days = activity.duration_days

        if days == 0:
            daily_costs[activity.start_date] = activity.budgeted_cost
        else:
            if method == CostDistribution.UNIFORM:
                daily_amount = activity.budgeted_cost / days
                for i in range(days):
                    day = activity.start_date + timedelta(days=i)
                    daily_costs[day] = daily_amount

            elif method == CostDistribution.FRONT_LOADED:
                # Higher at start, decreasing
                total_weight = sum(range(days, 0, -1))
                for i in range(days):
                    day = activity.start_date + timedelta(days=i)
                    weight = (days - i) / total_weight
                    daily_costs[day] = activity.budgeted_cost * weight

            elif method == CostDistribution.BACK_LOADED:
                # Lower at start, increasing
                total_weight = sum(range(1, days + 1))
                for i in range(days):
                    day = activity.start_date + timedelta(days=i)
                    weight = (i + 1) / total_weight
                    daily_costs[day] = activity.budgeted_cost * weight

            elif method == CostDistribution.S_CURVE:
                # S-curve distribution (sigmoid)
                for i in range(days):
                    day = activity.start_date + timedelta(days=i)
                    # Sigmoid function normalized
                    x = (i / days - 0.5) * 10
                    sigmoid = 1 / (1 + np.exp(-x))
                    daily_costs[day] = activity.budgeted_cost * sigmoid / days * 2

        # Calculate cumulative
        cumulative = {}
        running_total = 0
        for day in sorted(daily_costs.keys()):
            running_total += daily_costs[day]
            cumulative[day] = running_total

        return CostLoadedActivity(
            activity=activity,
            daily_costs=daily_costs,
            cumulative_costs=cumulative
        )

    def generate_cash_flow(self,
                           activities: List[ScheduleActivity],
                           project_name: str = "Project",
                           distribution: CostDistribution = CostDistribution.S_CURVE) -> CashFlowProjection:
        """Generate project cash flow projection."""

        # Distribute costs for all activities
        loaded_activities = [
            self.distribute_cost(a, distribution)
            for a in activities
        ]

        # Aggregate daily costs
        daily_costs = defaultdict(float)
        for loaded in loaded_activities:
            for day, cost in loaded.daily_costs.items():
                daily_costs[day] += cost

        # Sort and calculate cumulative
        sorted_days = sorted(daily_costs.keys())
        cumulative = {}
        running_total = 0
        for day in sorted_days:
            running_total += daily_costs[day]
            cumulative[day] = running_total

        # Aggregate to weekly
        weekly_costs = defaultdict(float)
        for day, cost in daily_costs.items():
            week_key = day.strftime('%Y-W%W')
            weekly_costs[week_key] += cost

        # Aggregate to monthly
        monthly_costs = defaultdict(float)
        for day, cost in daily_costs.items():
            month_key = day.strftime('%Y-%m')
            monthly_costs[month_key] += cost

        return CashFlowProjection(
            project_name=project_name,
            start_date=min(daily_costs.keys()) if daily_costs else date.today(),
            end_date=max(daily_costs.keys()) if daily_costs else date.today(),
            total_cost=sum(daily_costs.values()),
            daily_costs=dict(daily_costs),
            weekly_costs=dict(weekly_costs),
            monthly_costs=dict(monthly_costs),
            cumulative=cumulative
        )

    def calculate_earned_value(self,
                                activities: List[ScheduleActivity],
                                progress: Dict[str, float],  # activity_id -> percent complete
                                actual_costs: Dict[str, float],  # activity_id -> actual cost
                                data_date: date) -> EarnedValueMetrics:
        """Calculate earned value metrics."""

        # Generate planned value curve
        cash_flow = self.generate_cash_flow(activities)

        # Planned Value (BCWS) - budgeted cost through data date
        pv = sum(
            cost for day, cost in cash_flow.daily_costs.items()
            if day <= data_date
        )

        # Earned Value (BCWP) - budgeted cost * percent complete
        ev = sum(
            a.budgeted_cost * progress.get(a.activity_id, 0) / 100
            for a in activities
        )

        # Actual Cost (ACWP)
        ac = sum(actual_costs.values())

        # Variances
        sv = ev - pv
        cv = ev - ac

        # Indices
        spi = ev / pv if pv > 0 else 0
        cpi = ev / ac if ac > 0 else 0

        # Estimate at completion
        bac = sum(a.budgeted_cost for a in activities)
        if cpi > 0:
            eac = bac / cpi
        else:
            eac = bac

        etc = eac - ac

        return EarnedValueMetrics(
            data_date=data_date,
            planned_value=round(pv, 2),
            earned_value=round(ev, 2),
            actual_cost=round(ac, 2),
            schedule_variance=round(sv, 2),
            cost_variance=round(cv, 2),
            spi=round(spi, 2),
            cpi=round(cpi, 2),
            eac=round(eac, 2),
            etc=round(etc, 2)
        )

    def export_cash_flow(self,
                         cash_flow: CashFlowProjection,
                         output_path: str) -> str:
        """Export cash flow to Excel."""

        with pd.ExcelWriter(output_path, engine='openpyxl') as writer:
            # Summary
            summary_df = pd.DataFrame([{
                'Project': cash_flow.project_name,
                'Start Date': cash_flow.start_date,
                'End Date': cash_flow.end_date,
                'Total Cost': cash_flow.total_cost
            }])
            summary_df.to_excel(writer, sheet_name='Summary', index=False)

            # Monthly
            monthly_df = pd.DataFrame([
                {'Month': month, 'Cost': cost}
                for month, cost in sorted(cash_flow.monthly_costs.items())
            ])
            monthly_df.to_excel(writer, sheet_name='Monthly', index=False)

            # Weekly
            weekly_df = pd.DataFrame([
                {'Week': week, 'Cost': cost}
                for week, cost in sorted(cash_flow.weekly_costs.items())
            ])
            weekly_df.to_excel(writer, sheet_name='Weekly', index=False)

            # Daily with cumulative
            daily_df = pd.DataFrame([
                {
                    'Date': day.strftime('%Y-%m-%d'),
                    'Daily Cost': round(cash_flow.daily_costs[day], 2),
                    'Cumulative': round(cash_flow.cumulative[day], 2)
                }
                for day in sorted(cash_flow.daily_costs.keys())
            ])
            daily_df.to_excel(writer, sheet_name='Daily', index=False)

        return output_path

    def import_schedule_from_csv(self,
                                  schedule_file: str,
                                  work_items_file: str) -> List[ScheduleActivity]:
        """Import schedule and work items from CSV files."""

        schedule_df = pd.read_csv(schedule_file)
        work_items_df = pd.read_csv(work_items_file)

        activities = []

        for _, row in schedule_df.iterrows():
            activity_id = row['activity_id']

            # Get work items for this activity
            activity_items = work_items_df[
                work_items_df['activity_id'] == activity_id
            ].to_dict('records')

            activity = self.create_schedule_activity(
                activity_id=activity_id,
                description=row['description'],
                start_date=pd.to_datetime(row['start_date']).date(),
                duration_days=int(row['duration_days']),
                work_items=activity_items,
                predecessors=row.get('predecessors', '').split(',') if pd.notna(row.get('predecessors')) else []
            )
            activities.append(activity)

        return activities
```

## Quick Start

```python
from datetime import date

# Load CWICR data
cwicr = pd.read_parquet("ddc_cwicr_en.parquet")

# Initialize integrator
integrator = CWICRScheduleIntegrator(cwicr)

# Create activities
activity1 = integrator.create_schedule_activity(
    activity_id="A001",
    description="Foundation Excavation",
    start_date=date(2024, 6, 1),
    duration_days=10,
    work_items=[
        {'work_item_code': 'EXCV-001', 'quantity': 500}
    ]
)

activity2 = integrator.create_schedule_activity(
    activity_id="A002",
    description="Foundation Concrete",
    start_date=date(2024, 6, 11),
    duration_days=15,
    work_items=[
        {'work_item_code': 'CONC-001', 'quantity': 150},
        {'work_item_code': 'REBAR-002', 'quantity': 5000}
    ],
    predecessors=["A001"]
)

# Generate cash flow
activities = [activity1, activity2]
cash_flow = integrator.generate_cash_flow(activities, "Building Project")

print(f"Total Cost: ${cash_flow.total_cost:,.2f}")
print(f"Project Duration: {(cash_flow.end_date - cash_flow.start_date).days} days")
```

## Common Use Cases

### 1. Monthly Cash Flow
```python
for month, cost in cash_flow.monthly_costs.items():
    print(f"{month}: ${cost:,.2f}")
```

### 2. Earned Value Analysis
```python
progress = {'A001': 100, 'A002': 60}
actual_costs = {'A001': 45000, 'A002': 72000}

evm = integrator.calculate_earned_value(
    activities,
    progress,
    actual_costs,
    data_date=date(2024, 6, 20)
)

print(f"CPI: {evm.cpi}")
print(f"SPI: {evm.spi}")
print(f"EAC: ${evm.eac:,.2f}")
```

### 3. Export Cash Flow
```python
integrator.export_cash_flow(cash_flow, "project_cash_flow.xlsx")
```

## Resources
- **GitHub**: [OpenConstructionEstimate-Jens-CWICR](https://github.com/jens-construction/OpenConstructionEstimate-Jens-CWICR)
- **Jens Book**: Chapter 3.2 - Cost-Schedule Integration


---


# CWICR Subcontractor Analyzer

## Business Case

### Problem Statement
Evaluating subcontractor bids requires:
- Fair price benchmarks
- Bid comparison
- Outlier identification
- Negotiation support

### Solution
Compare subcontractor bids against CWICR cost data to identify fair pricing, outliers, and negotiation opportunities.

### Business Value
- **Fair evaluation** - Objective benchmarks
- **Cost savings** - Identify overpriced bids
- **Risk detection** - Flag unrealistic low bids
- **Negotiation support** - Data-driven discussions

## Technical Implementation

```python
import pandas as pd
import numpy as np
from typing import Dict, Any, List, Optional
from dataclasses import dataclass
from enum import Enum
from statistics import mean, stdev


class BidStatus(Enum):
    """Bid evaluation status."""
    COMPETITIVE = "competitive"
    HIGH = "high"
    LOW = "low"
    OUTLIER_HIGH = "outlier_high"
    OUTLIER_LOW = "outlier_low"


@dataclass
class SubcontractorBid:
    """Subcontractor bid."""
    subcontractor_name: str
    trade: str
    bid_amount: float
    scope_items: List[Dict[str, Any]]
    includes_material: bool
    includes_labor: bool
    includes_equipment: bool
    duration_days: int
    notes: str = ""


@dataclass
class BidEvaluation:
    """Bid evaluation result."""
    subcontractor_name: str
    bid_amount: float
    benchmark_cost: float
    variance: float
    variance_percent: float
    status: BidStatus
    line_item_analysis: List[Dict[str, Any]]
    recommendation: str


class CWICRSubcontractor:
    """Analyze subcontractor bids using CWICR data."""

    OUTLIER_THRESHOLD = 0.30  # 30% from benchmark
    HIGH_THRESHOLD = 0.15    # 15% above benchmark
    LOW_THRESHOLD = -0.10    # 10% below benchmark

    def __init__(self,
                 cwicr_data: pd.DataFrame,
                 overhead_rate: float = 0.12,
                 profit_rate: float = 0.10):
        self.cost_data = cwicr_data
        self.overhead_rate = overhead_rate
        self.profit_rate = profit_rate
        self._index_data()

    def _index_data(self):
        """Index cost data."""
        if 'work_item_code' in self.cost_data.columns:
            self._code_index = self.cost_data.set_index('work_item_code')
        else:
            self._code_index = None

    def calculate_benchmark(self,
                            scope_items: List[Dict[str, Any]],
                            include_overhead: bool = True,
                            include_profit: bool = True) -> Dict[str, Any]:
        """Calculate benchmark cost for scope."""

        labor = 0
        material = 0
        equipment = 0

        line_items = []

        for item in scope_items:
            code = item.get('work_item_code', item.get('code'))
            qty = item.get('quantity', 0)

            if self._code_index is not None and code in self._code_index.index:
                wi = self._code_index.loc[code]
                item_labor = float(wi.get('labor_cost', 0) or 0) * qty
                item_material = float(wi.get('material_cost', 0) or 0) * qty
                item_equipment = float(wi.get('equipment_cost', 0) or 0) * qty

                labor += item_labor
                material += item_material
                equipment += item_equipment

                line_items.append({
                    'code': code,
                    'quantity': qty,
                    'labor': round(item_labor, 2),
                    'material': round(item_material, 2),
                    'equipment': round(item_equipment, 2),
                    'total': round(item_labor + item_material + item_equipment, 2)
                })

        direct_cost = labor + material + equipment

        overhead = direct_cost * self.overhead_rate if include_overhead else 0
        profit = (direct_cost + overhead) * self.profit_rate if include_profit else 0

        return {
            'labor': round(labor, 2),
            'material': round(material, 2),
            'equipment': round(equipment, 2),
            'direct_cost': round(direct_cost, 2),
            'overhead': round(overhead, 2),
            'profit': round(profit, 2),
            'total': round(direct_cost + overhead + profit, 2),
            'line_items': line_items
        }

    def evaluate_bid(self, bid: SubcontractorBid) -> BidEvaluation:
        """Evaluate single subcontractor bid."""

        benchmark = self.calculate_benchmark(bid.scope_items)
        benchmark_cost = benchmark['total']

        variance = bid.bid_amount - benchmark_cost
        variance_pct = (variance / benchmark_cost * 100) if benchmark_cost > 0 else 0

        # Determine status
        if variance_pct > self.OUTLIER_THRESHOLD * 100:
            status = BidStatus.OUTLIER_HIGH
            recommendation = "Bid significantly above benchmark. Request detailed breakdown or reject."
        elif variance_pct < -self.OUTLIER_THRESHOLD * 100:
            status = BidStatus.OUTLIER_LOW
            recommendation = "Bid significantly below benchmark. Verify scope understanding and capacity."
        elif variance_pct > self.HIGH_THRESHOLD * 100:
            status = BidStatus.HIGH
            recommendation = "Bid above benchmark. Consider negotiation or alternative bidders."
        elif variance_pct < self.LOW_THRESHOLD * 100:
            status = BidStatus.LOW
            recommendation = "Bid below benchmark. Verify completeness and quality approach."
        else:
            status = BidStatus.COMPETITIVE
            recommendation = "Bid within acceptable range. Proceed with standard evaluation."

        # Line item analysis
        line_analysis = []
        for i, item in enumerate(bid.scope_items):
            if i < len(benchmark['line_items']):
                bench_item = benchmark['line_items'][i]
                # Assume proportional pricing
                expected = bench_item['total'] / benchmark['direct_cost'] * bid.bid_amount if benchmark['direct_cost'] > 0 else 0
                line_analysis.append({
                    'code': item.get('work_item_code', item.get('code')),
                    'benchmark': bench_item['total'],
                    'expected_in_bid': round(expected, 2)
                })

        return BidEvaluation(
            subcontractor_name=bid.subcontractor_name,
            bid_amount=bid.bid_amount,
            benchmark_cost=benchmark_cost,
            variance=round(variance, 2),
            variance_percent=round(variance_pct, 1),
            status=status,
            line_item_analysis=line_analysis,
            recommendation=recommendation
        )

    def compare_bids(self,
                      bids: List[SubcontractorBid]) -> Dict[str, Any]:
        """Compare multiple bids."""

        if not bids:
            return {}

        evaluations = [self.evaluate_bid(bid) for bid in bids]

        # Statistics
        amounts = [e.bid_amount for e in evaluations]
        avg_bid = mean(amounts)
        std_bid = stdev(amounts) if len(amounts) > 1 else 0

        # Rank by variance from benchmark
        ranked = sorted(evaluations, key=lambda x: abs(x.variance_percent))

        # Find best value
        competitive = [e for e in evaluations if e.status == BidStatus.COMPETITIVE]
        if competitive:
            best_value = min(competitive, key=lambda x: x.bid_amount)
        else:
            best_value = ranked[0]

        # Identify outliers
        outliers = [e for e in evaluations if e.status in [BidStatus.OUTLIER_HIGH, BidStatus.OUTLIER_LOW]]

        return {
            'bid_count': len(bids),
            'average_bid': round(avg_bid, 2),
            'std_deviation': round(std_bid, 2),
            'spread': round(max(amounts) - min(amounts), 2),
            'spread_percent': round((max(amounts) - min(amounts)) / avg_bid * 100, 1) if avg_bid > 0 else 0,
            'benchmark': evaluations[0].benchmark_cost,
            'best_value': {
                'name': best_value.subcontractor_name,
                'amount': best_value.bid_amount,
                'variance_from_benchmark': best_value.variance_percent
            },
            'lowest_bid': {
                'name': min(evaluations, key=lambda x: x.bid_amount).subcontractor_name,
                'amount': min(amounts)
            },
            'outliers': [
                {'name': e.subcontractor_name, 'status': e.status.value, 'variance': e.variance_percent}
                for e in outliers
            ],
            'evaluations': evaluations
        }

    def generate_negotiation_points(self,
                                     evaluation: BidEvaluation) -> List[Dict[str, Any]]:
        """Generate negotiation points based on evaluation."""

        points = []

        if evaluation.status in [BidStatus.HIGH, BidStatus.OUTLIER_HIGH]:
            points.append({
                'topic': 'Overall Price',
                'benchmark': evaluation.benchmark_cost,
                'bid': evaluation.bid_amount,
                'target': round(evaluation.benchmark_cost * 1.05, 2),  # 5% above benchmark
                'potential_savings': round(evaluation.bid_amount - evaluation.benchmark_cost * 1.05, 2)
            })

            # Suggest line item discussions
            for item in evaluation.line_item_analysis:
                points.append({
                    'topic': f"Line Item: {item['code']}",
                    'benchmark': item['benchmark'],
                    'suggestion': 'Request detailed breakdown'
                })

        return points

    def export_bid_comparison(self,
                               comparison: Dict[str, Any],
                               output_path: str) -> str:
        """Export bid comparison to Excel."""

        with pd.ExcelWriter(output_path, engine='openpyxl') as writer:
            # Summary
            summary_df = pd.DataFrame([{
                'Number of Bids': comparison['bid_count'],
                'Average Bid': comparison['average_bid'],
                'Spread': comparison['spread'],
                'Spread %': comparison['spread_percent'],
                'Benchmark': comparison['benchmark'],
                'Best Value Bidder': comparison['best_value']['name'],
                'Lowest Bidder': comparison['lowest_bid']['name']
            }])
            summary_df.to_excel(writer, sheet_name='Summary', index=False)

            # All evaluations
            eval_df = pd.DataFrame([
                {
                    'Subcontractor': e.subcontractor_name,
                    'Bid Amount': e.bid_amount,
                    'Benchmark': e.benchmark_cost,
                    'Variance': e.variance,
                    'Variance %': e.variance_percent,
                    'Status': e.status.value,
                    'Recommendation': e.recommendation
                }
                for e in comparison['evaluations']
            ])
            eval_df.to_excel(writer, sheet_name='Evaluations', index=False)

        return output_path
```

## Quick Start

```python
# Load CWICR data
cwicr = pd.read_parquet("ddc_cwicr_en.parquet")

# Initialize analyzer
analyzer = CWICRSubcontractor(cwicr)

# Define scope
scope = [
    {'work_item_code': 'ELEC-001', 'quantity': 100},
    {'work_item_code': 'ELEC-002', 'quantity': 50}
]

# Create bid
bid = SubcontractorBid(
    subcontractor_name="ABC Electric",
    trade="Electrical",
    bid_amount=75000,
    scope_items=scope,
    includes_material=True,
    includes_labor=True,
    includes_equipment=True,
    duration_days=30
)

# Evaluate
evaluation = analyzer.evaluate_bid(bid)
print(f"Status: {evaluation.status.value}")
print(f"Variance: {evaluation.variance_percent}%")
print(f"Recommendation: {evaluation.recommendation}")
```

## Common Use Cases

### 1. Compare Multiple Bids
```python
bids = [
    SubcontractorBid("ABC Electric", "Electrical", 75000, scope, True, True, True, 30),
    SubcontractorBid("XYZ Power", "Electrical", 68000, scope, True, True, True, 35),
    SubcontractorBid("Quick Elec", "Electrical", 82000, scope, True, True, True, 25)
]

comparison = analyzer.compare_bids(bids)
print(f"Best Value: {comparison['best_value']['name']}")
```

### 2. Negotiation Support
```python
points = analyzer.generate_negotiation_points(evaluation)
for point in points:
    print(f"{point['topic']}: Target ${point.get('target', 'N/A')}")
```

### 3. Export Report
```python
analyzer.export_bid_comparison(comparison, "bid_comparison.xlsx")
```

## Resources
- **GitHub**: [OpenConstructionEstimate-Jens-CWICR](https://github.com/jens-construction/OpenConstructionEstimate-Jens-CWICR)
- **Jens Book**: Chapter 3.2 - Subcontractor Management


---


# CWICR Takeoff Helper

## Business Case

### Problem Statement
Quantity takeoff requires:
- Accurate calculations from dimensions
- Correct unit conversions
- Waste factor application
- Complete scope coverage

### Solution
Assist takeoff process with CWICR-based calculations, automatic waste factors, unit conversions, and related item suggestions.

### Business Value
- **Accuracy** - Validated calculations
- **Completeness** - Related items suggested
- **Speed** - Quick quantity calculations
- **Consistency** - Standard approaches

## Technical Implementation

```python
import pandas as pd
import numpy as np
from typing import Dict, Any, List, Optional, Tuple
from dataclasses import dataclass
from enum import Enum
import math


class TakeoffType(Enum):
    """Types of takeoff calculations."""
    LINEAR = "linear"        # Length
    AREA = "area"            # Square measure
    VOLUME = "volume"        # Cubic measure
    COUNT = "count"          # Each/number
    WEIGHT = "weight"        # By weight


class UnitSystem(Enum):
    """Unit systems."""
    METRIC = "metric"
    IMPERIAL = "imperial"


@dataclass
class TakeoffItem:
    """Single takeoff item."""
    work_item_code: str
    description: str
    takeoff_type: TakeoffType
    gross_quantity: float
    waste_factor: float
    net_quantity: float
    unit: str
    dimensions: Dict[str, float]
    calculation: str


@dataclass
class TakeoffResult:
    """Complete takeoff result."""
    items: List[TakeoffItem]
    total_items: int
    related_suggestions: List[str]


# Unit conversion factors
CONVERSIONS = {
    # Length
    ('m', 'ft'): 3.28084,
    ('ft', 'm'): 0.3048,
    ('m', 'in'): 39.3701,
    ('in', 'm'): 0.0254,

    # Area
    ('m2', 'sf'): 10.7639,
    ('sf', 'm2'): 0.0929,

    # Volume
    ('m3', 'cf'): 35.3147,
    ('cf', 'm3'): 0.0283,
    ('m3', 'cy'): 1.30795,
    ('cy', 'm3'): 0.7646,

    # Weight
    ('kg', 'lb'): 2.20462,
    ('lb', 'kg'): 0.453592,
    ('ton', 'kg'): 1000,
    ('kg', 'ton'): 0.001
}

# Standard waste factors
WASTE_FACTORS = {
    'concrete': 0.05,
    'rebar': 0.08,
    'formwork': 0.10,
    'brick': 0.10,
    'block': 0.08,
    'drywall': 0.12,
    'tile': 0.15,
    'lumber': 0.12,
    'roofing': 0.10,
    'paint': 0.10,
    'pipe': 0.05,
    'wire': 0.05,
    'duct': 0.08,
    'default': 0.05
}

# Related work items by category
RELATED_ITEMS = {
    'concrete': ['formwork', 'rebar', 'curing', 'finishing'],
    'masonry': ['mortar', 'reinforcement', 'ties', 'lintels'],
    'drywall': ['framing', 'insulation', 'taping', 'painting'],
    'roofing': ['underlayment', 'flashing', 'ventilation', 'insulation'],
    'flooring': ['underlayment', 'adhesive', 'trim', 'transitions']
}


class CWICRTakeoffHelper:
    """Assist with quantity takeoff using CWICR data."""

    def __init__(self, cwicr_data: pd.DataFrame = None):
        self.cwicr = cwicr_data
        if cwicr_data is not None:
            self._index_cwicr()

    def _index_cwicr(self):
        """Index CWICR data."""
        if 'work_item_code' in self.cwicr.columns:
            self._cwicr_index = self.cwicr.set_index('work_item_code')
        else:
            self._cwicr_index = None

    def convert_unit(self, value: float, from_unit: str, to_unit: str) -> float:
        """Convert between units."""
        if from_unit == to_unit:
            return value

        key = (from_unit.lower(), to_unit.lower())
        if key in CONVERSIONS:
            return value * CONVERSIONS[key]

        # Try reverse
        reverse_key = (to_unit.lower(), from_unit.lower())
        if reverse_key in CONVERSIONS:
            return value / CONVERSIONS[reverse_key]

        return value

    def get_waste_factor(self, work_item_code: str) -> float:
        """Get waste factor for work item."""
        code_lower = work_item_code.lower()

        for material, factor in WASTE_FACTORS.items():
            if material in code_lower:
                return factor

        return WASTE_FACTORS['default']

    def calculate_area(self,
                       length: float,
                       width: float,
                       deductions: List[Tuple[float, float]] = None) -> Dict[str, float]:
        """Calculate area with deductions."""

        gross_area = length * width

        deduction_area = 0
        if deductions:
            for d_length, d_width in deductions:
                deduction_area += d_length * d_width

        net_area = gross_area - deduction_area

        return {
            'gross_area': round(gross_area, 2),
            'deductions': round(deduction_area, 2),
            'net_area': round(net_area, 2),
            'calculation': f"{length} x {width} = {gross_area}, minus {deduction_area} deductions"
        }

    def calculate_volume(self,
                          length: float,
                          width: float,
                          depth: float) -> Dict[str, float]:
        """Calculate volume."""

        volume = length * width * depth

        return {
            'volume': round(volume, 3),
            'calculation': f"{length} x {width} x {depth} = {volume}"
        }

    def calculate_perimeter(self,
                            length: float,
                            width: float) -> Dict[str, float]:
        """Calculate perimeter."""

        perimeter = 2 * (length + width)

        return {
            'perimeter': round(perimeter, 2),
            'calculation': f"2 x ({length} + {width}) = {perimeter}"
        }

    def calculate_concrete(self,
                            length: float,
                            width: float,
                            thickness: float,
                            work_item_code: str = "CONC-001") -> TakeoffItem:
        """Calculate concrete quantity with related items."""

        volume = length * width * thickness
        waste = self.get_waste_factor(work_item_code)
        net_qty = volume * (1 + waste)

        return TakeoffItem(
            work_item_code=work_item_code,
            description="Concrete",
            takeoff_type=TakeoffType.VOLUME,
            gross_quantity=round(volume, 3),
            waste_factor=waste,
            net_quantity=round(net_qty, 3),
            unit="m3",
            dimensions={'length': length, 'width': width, 'thickness': thickness},
            calculation=f"{length}m x {width}m x {thickness}m = {volume:.3f} m3 + {waste:.0%} waste"
        )

    def calculate_wall_area(self,
                             perimeter: float,
                             height: float,
                             openings: List[Tuple[float, float]] = None,
                             work_item_code: str = "WALL-001") -> TakeoffItem:
        """Calculate wall area with openings deducted."""

        gross_area = perimeter * height

        opening_area = 0
        if openings:
            for w, h in openings:
                opening_area += w * h

        net_area = gross_area - opening_area
        waste = self.get_waste_factor(work_item_code)
        order_qty = net_area * (1 + waste)

        return TakeoffItem(
            work_item_code=work_item_code,
            description="Wall finish",
            takeoff_type=TakeoffType.AREA,
            gross_quantity=round(gross_area, 2),
            waste_factor=waste,
            net_quantity=round(order_qty, 2),
            unit="m2",
            dimensions={'perimeter': perimeter, 'height': height, 'openings': len(openings or [])},
            calculation=f"{perimeter}m x {height}m = {gross_area:.2f} m2 - {opening_area:.2f} openings + {waste:.0%} waste"
        )

    def calculate_flooring(self,
                            length: float,
                            width: float,
                            work_item_code: str = "FLOOR-001") -> TakeoffItem:
        """Calculate flooring quantity."""

        area = length * width
        waste = self.get_waste_factor(work_item_code)
        order_qty = area * (1 + waste)

        return TakeoffItem(
            work_item_code=work_item_code,
            description="Flooring",
            takeoff_type=TakeoffType.AREA,
            gross_quantity=round(area, 2),
            waste_factor=waste,
            net_quantity=round(order_qty, 2),
            unit="m2",
            dimensions={'length': length, 'width': width},
            calculation=f"{length}m x {width}m = {area:.2f} m2 + {waste:.0%} waste"
        )

    def calculate_rebar(self,
                         concrete_volume: float,
                         kg_per_m3: float = 100,
                         work_item_code: str = "REBAR-001") -> TakeoffItem:
        """Calculate rebar from concrete volume."""

        weight = concrete_volume * kg_per_m3
        waste = self.get_waste_factor(work_item_code)
        order_qty = weight * (1 + waste)

        return TakeoffItem(
            work_item_code=work_item_code,
            description="Reinforcement",
            takeoff_type=TakeoffType.WEIGHT,
            gross_quantity=round(weight, 1),
            waste_factor=waste,
            net_quantity=round(order_qty, 1),
            unit="kg",
            dimensions={'concrete_m3': concrete_volume, 'kg_per_m3': kg_per_m3},
            calculation=f"{concrete_volume} m3 x {kg_per_m3} kg/m3 = {weight:.1f} kg + {waste:.0%} waste"
        )

    def suggest_related_items(self, work_item_code: str) -> List[str]:
        """Suggest related work items."""

        code_lower = work_item_code.lower()

        for category, related in RELATED_ITEMS.items():
            if category in code_lower:
                return related

        return []

    def room_takeoff(self,
                      length: float,
                      width: float,
                      height: float,
                      openings: List[Tuple[float, float]] = None) -> TakeoffResult:
        """Complete room takeoff."""

        items = []

        # Floor
        floor = self.calculate_flooring(length, width, "FLOOR-001")
        items.append(floor)

        # Ceiling (same as floor)
        ceiling = TakeoffItem(
            work_item_code="CEIL-001",
            description="Ceiling",
            takeoff_type=TakeoffType.AREA,
            gross_quantity=floor.gross_quantity,
            waste_factor=floor.waste_factor,
            net_quantity=floor.net_quantity,
            unit="m2",
            dimensions=floor.dimensions,
            calculation=f"Same as floor: {floor.gross_quantity} m2"
        )
        items.append(ceiling)

        # Walls
        perimeter = 2 * (length + width)
        walls = self.calculate_wall_area(perimeter, height, openings, "WALL-001")
        items.append(walls)

        # Related suggestions
        suggestions = ['paint', 'baseboard', 'trim', 'electrical outlets']

        return TakeoffResult(
            items=items,
            total_items=len(items),
            related_suggestions=suggestions
        )

    def export_takeoff(self,
                        items: List[TakeoffItem],
                        output_path: str) -> str:
        """Export takeoff to Excel."""

        with pd.ExcelWriter(output_path, engine='openpyxl') as writer:
            df = pd.DataFrame([
                {
                    'Work Item Code': item.work_item_code,
                    'Description': item.description,
                    'Type': item.takeoff_type.value,
                    'Gross Qty': item.gross_quantity,
                    'Waste %': f"{item.waste_factor:.0%}",
                    'Net Qty': item.net_quantity,
                    'Unit': item.unit,
                    'Calculation': item.calculation
                }
                for item in items
            ])
            df.to_excel(writer, sheet_name='Takeoff', index=False)

        return output_path
```

## Quick Start

```python
# Initialize helper
helper = CWICRTakeoffHelper()

# Calculate concrete slab
concrete = helper.calculate_concrete(
    length=10,
    width=8,
    thickness=0.2
)

print(f"Gross: {concrete.gross_quantity} m3")
print(f"Order Qty: {concrete.net_quantity} m3")
print(f"Calculation: {concrete.calculation}")
```

## Common Use Cases

### 1. Room Takeoff
```python
room = helper.room_takeoff(
    length=5,
    width=4,
    height=2.8,
    openings=[(0.9, 2.1), (1.2, 1.5)]  # door, window
)

for item in room.items:
    print(f"{item.description}: {item.net_quantity} {item.unit}")
```

### 2. Unit Conversion
```python
meters = helper.convert_unit(100, 'ft', 'm')
print(f"100 ft = {meters:.2f} m")
```

### 3. Rebar from Concrete
```python
concrete = helper.calculate_concrete(10, 8, 0.3)
rebar = helper.calculate_rebar(concrete.gross_quantity, kg_per_m3=120)
print(f"Rebar: {rebar.net_quantity} kg")
```

### 4. Related Items
```python
related = helper.suggest_related_items("CONC-SLAB-001")
print(f"Related: {related}")
```

## Resources
- **GitHub**: [OpenConstructionEstimate-Jens-CWICR](https://github.com/jens-construction/OpenConstructionEstimate-Jens-CWICR)
- **Jens Book**: Chapter 3.1 - Quantity Takeoff Methods


---


# CWICR Unit Converter

## Business Case

### Problem Statement
Construction data comes in various unit systems:
- Metric vs Imperial measurements
- Different unit conventions by trade
- BIM quantities need normalization
- Regional standards differ

### Solution
Comprehensive unit conversion for construction quantities, normalizing data for CWICR integration and analysis.

### Business Value
- **Accuracy** - Eliminate unit conversion errors
- **Consistency** - Standardize across projects
- **Integration** - BIM to cost data alignment
- **Global** - Support international projects

## Technical Implementation

```python
import pandas as pd
import numpy as np
from typing import Dict, Any, List, Optional, Tuple, Union
from dataclasses import dataclass
from enum import Enum


class UnitCategory(Enum):
    """Categories of measurement units."""
    LENGTH = "length"
    AREA = "area"
    VOLUME = "volume"
    WEIGHT = "weight"
    TIME = "time"
    QUANTITY = "quantity"


class UnitSystem(Enum):
    """Unit systems."""
    METRIC = "metric"
    IMPERIAL = "imperial"
    MIXED = "mixed"


@dataclass
class UnitConversion:
    """Unit conversion result."""
    original_value: float
    original_unit: str
    converted_value: float
    target_unit: str
    conversion_factor: float
    category: UnitCategory


# Conversion factors to base units
# Base units: meter (length), m² (area), m³ (volume), kg (weight), hour (time)

CONVERSIONS = {
    # Length to meters
    'm': {'factor': 1.0, 'category': UnitCategory.LENGTH, 'base': 'm'},
    'meter': {'factor': 1.0, 'category': UnitCategory.LENGTH, 'base': 'm'},
    'meters': {'factor': 1.0, 'category': UnitCategory.LENGTH, 'base': 'm'},
    'cm': {'factor': 0.01, 'category': UnitCategory.LENGTH, 'base': 'm'},
    'mm': {'factor': 0.001, 'category': UnitCategory.LENGTH, 'base': 'm'},
    'km': {'factor': 1000.0, 'category': UnitCategory.LENGTH, 'base': 'm'},
    'ft': {'factor': 0.3048, 'category': UnitCategory.LENGTH, 'base': 'm'},
    'feet': {'factor': 0.3048, 'category': UnitCategory.LENGTH, 'base': 'm'},
    'foot': {'factor': 0.3048, 'category': UnitCategory.LENGTH, 'base': 'm'},
    'in': {'factor': 0.0254, 'category': UnitCategory.LENGTH, 'base': 'm'},
    'inch': {'factor': 0.0254, 'category': UnitCategory.LENGTH, 'base': 'm'},
    'inches': {'factor': 0.0254, 'category': UnitCategory.LENGTH, 'base': 'm'},
    'yd': {'factor': 0.9144, 'category': UnitCategory.LENGTH, 'base': 'm'},
    'yard': {'factor': 0.9144, 'category': UnitCategory.LENGTH, 'base': 'm'},
    'yards': {'factor': 0.9144, 'category': UnitCategory.LENGTH, 'base': 'm'},
    'mi': {'factor': 1609.344, 'category': UnitCategory.LENGTH, 'base': 'm'},
    'mile': {'factor': 1609.344, 'category': UnitCategory.LENGTH, 'base': 'm'},
    'lf': {'factor': 0.3048, 'category': UnitCategory.LENGTH, 'base': 'm'},  # Linear foot

    # Area to m²
    'm2': {'factor': 1.0, 'category': UnitCategory.AREA, 'base': 'm2'},
    'm²': {'factor': 1.0, 'category': UnitCategory.AREA, 'base': 'm2'},
    'sqm': {'factor': 1.0, 'category': UnitCategory.AREA, 'base': 'm2'},
    'cm2': {'factor': 0.0001, 'category': UnitCategory.AREA, 'base': 'm2'},
    'mm2': {'factor': 0.000001, 'category': UnitCategory.AREA, 'base': 'm2'},
    'ha': {'factor': 10000.0, 'category': UnitCategory.AREA, 'base': 'm2'},
    'hectare': {'factor': 10000.0, 'category': UnitCategory.AREA, 'base': 'm2'},
    'ft2': {'factor': 0.092903, 'category': UnitCategory.AREA, 'base': 'm2'},
    'sf': {'factor': 0.092903, 'category': UnitCategory.AREA, 'base': 'm2'},
    'sqft': {'factor': 0.092903, 'category': UnitCategory.AREA, 'base': 'm2'},
    'yd2': {'factor': 0.836127, 'category': UnitCategory.AREA, 'base': 'm2'},
    'sy': {'factor': 0.836127, 'category': UnitCategory.AREA, 'base': 'm2'},  # Square yard
    'acre': {'factor': 4046.86, 'category': UnitCategory.AREA, 'base': 'm2'},

    # Volume to m³
    'm3': {'factor': 1.0, 'category': UnitCategory.VOLUME, 'base': 'm3'},
    'm³': {'factor': 1.0, 'category': UnitCategory.VOLUME, 'base': 'm3'},
    'cbm': {'factor': 1.0, 'category': UnitCategory.VOLUME, 'base': 'm3'},
    'l': {'factor': 0.001, 'category': UnitCategory.VOLUME, 'base': 'm3'},
    'liter': {'factor': 0.001, 'category': UnitCategory.VOLUME, 'base': 'm3'},
    'litre': {'factor': 0.001, 'category': UnitCategory.VOLUME, 'base': 'm3'},
    'ml': {'factor': 0.000001, 'category': UnitCategory.VOLUME, 'base': 'm3'},
    'ft3': {'factor': 0.0283168, 'category': UnitCategory.VOLUME, 'base': 'm3'},
    'cf': {'factor': 0.0283168, 'category': UnitCategory.VOLUME, 'base': 'm3'},
    'cuft': {'factor': 0.0283168, 'category': UnitCategory.VOLUME, 'base': 'm3'},
    'yd3': {'factor': 0.764555, 'category': UnitCategory.VOLUME, 'base': 'm3'},
    'cy': {'factor': 0.764555, 'category': UnitCategory.VOLUME, 'base': 'm3'},  # Cubic yard
    'cuyd': {'factor': 0.764555, 'category': UnitCategory.VOLUME, 'base': 'm3'},
    'gal': {'factor': 0.00378541, 'category': UnitCategory.VOLUME, 'base': 'm3'},
    'gallon': {'factor': 0.00378541, 'category': UnitCategory.VOLUME, 'base': 'm3'},

    # Weight to kg
    'kg': {'factor': 1.0, 'category': UnitCategory.WEIGHT, 'base': 'kg'},
    'kilogram': {'factor': 1.0, 'category': UnitCategory.WEIGHT, 'base': 'kg'},
    'g': {'factor': 0.001, 'category': UnitCategory.WEIGHT, 'base': 'kg'},
    'gram': {'factor': 0.001, 'category': UnitCategory.WEIGHT, 'base': 'kg'},
    'mg': {'factor': 0.000001, 'category': UnitCategory.WEIGHT, 'base': 'kg'},
    't': {'factor': 1000.0, 'category': UnitCategory.WEIGHT, 'base': 'kg'},
    'ton': {'factor': 1000.0, 'category': UnitCategory.WEIGHT, 'base': 'kg'},  # Metric ton
    'tonne': {'factor': 1000.0, 'category': UnitCategory.WEIGHT, 'base': 'kg'},
    'mt': {'factor': 1000.0, 'category': UnitCategory.WEIGHT, 'base': 'kg'},
    'lb': {'factor': 0.453592, 'category': UnitCategory.WEIGHT, 'base': 'kg'},
    'lbs': {'factor': 0.453592, 'category': UnitCategory.WEIGHT, 'base': 'kg'},
    'pound': {'factor': 0.453592, 'category': UnitCategory.WEIGHT, 'base': 'kg'},
    'oz': {'factor': 0.0283495, 'category': UnitCategory.WEIGHT, 'base': 'kg'},
    'ounce': {'factor': 0.0283495, 'category': UnitCategory.WEIGHT, 'base': 'kg'},
    'st': {'factor': 907.185, 'category': UnitCategory.WEIGHT, 'base': 'kg'},  # Short ton (US)

    # Time to hours
    'hr': {'factor': 1.0, 'category': UnitCategory.TIME, 'base': 'hr'},
    'hour': {'factor': 1.0, 'category': UnitCategory.TIME, 'base': 'hr'},
    'hours': {'factor': 1.0, 'category': UnitCategory.TIME, 'base': 'hr'},
    'h': {'factor': 1.0, 'category': UnitCategory.TIME, 'base': 'hr'},
    'min': {'factor': 1/60, 'category': UnitCategory.TIME, 'base': 'hr'},
    'minute': {'factor': 1/60, 'category': UnitCategory.TIME, 'base': 'hr'},
    'day': {'factor': 8.0, 'category': UnitCategory.TIME, 'base': 'hr'},  # 8-hour workday
    'days': {'factor': 8.0, 'category': UnitCategory.TIME, 'base': 'hr'},
    'week': {'factor': 40.0, 'category': UnitCategory.TIME, 'base': 'hr'},  # 40-hour week

    # Quantity (no conversion, just counting)
    'ea': {'factor': 1.0, 'category': UnitCategory.QUANTITY, 'base': 'ea'},
    'each': {'factor': 1.0, 'category': UnitCategory.QUANTITY, 'base': 'ea'},
    'pc': {'factor': 1.0, 'category': UnitCategory.QUANTITY, 'base': 'ea'},
    'pcs': {'factor': 1.0, 'category': UnitCategory.QUANTITY, 'base': 'ea'},
    'piece': {'factor': 1.0, 'category': UnitCategory.QUANTITY, 'base': 'ea'},
    'pieces': {'factor': 1.0, 'category': UnitCategory.QUANTITY, 'base': 'ea'},
    'no': {'factor': 1.0, 'category': UnitCategory.QUANTITY, 'base': 'ea'},
    'nr': {'factor': 1.0, 'category': UnitCategory.QUANTITY, 'base': 'ea'},
    'set': {'factor': 1.0, 'category': UnitCategory.QUANTITY, 'base': 'ea'},
    'lot': {'factor': 1.0, 'category': UnitCategory.QUANTITY, 'base': 'ea'},
    'ls': {'factor': 1.0, 'category': UnitCategory.QUANTITY, 'base': 'ea'},  # Lump sum
}


class CWICRUnitConverter:
    """Convert between construction units."""

    def __init__(self):
        self.conversions = CONVERSIONS

    def normalize_unit(self, unit: str) -> str:
        """Normalize unit string for lookup."""
        return str(unit).lower().strip().replace(' ', '').replace('.', '')

    def get_unit_info(self, unit: str) -> Optional[Dict[str, Any]]:
        """Get conversion info for unit."""
        normalized = self.normalize_unit(unit)
        return self.conversions.get(normalized)

    def convert(self,
                value: float,
                from_unit: str,
                to_unit: str) -> UnitConversion:
        """Convert value between units."""

        from_info = self.get_unit_info(from_unit)
        to_info = self.get_unit_info(to_unit)

        if not from_info:
            raise ValueError(f"Unknown source unit: {from_unit}")
        if not to_info:
            raise ValueError(f"Unknown target unit: {to_unit}")

        if from_info['category'] != to_info['category']:
            raise ValueError(
                f"Cannot convert between {from_info['category'].value} and {to_info['category'].value}"
            )

        # Convert: source -> base -> target
        base_value = value * from_info['factor']
        converted_value = base_value / to_info['factor']
        conversion_factor = from_info['factor'] / to_info['factor']

        return UnitConversion(
            original_value=value,
            original_unit=from_unit,
            converted_value=round(converted_value, 6),
            target_unit=to_unit,
            conversion_factor=conversion_factor,
            category=from_info['category']
        )

    def to_metric(self, value: float, from_unit: str) -> UnitConversion:
        """Convert to standard metric unit."""

        info = self.get_unit_info(from_unit)
        if not info:
            raise ValueError(f"Unknown unit: {from_unit}")

        base_unit = info['base']
        return self.convert(value, from_unit, base_unit)

    def to_imperial(self, value: float, from_unit: str) -> UnitConversion:
        """Convert to common imperial unit."""

        info = self.get_unit_info(from_unit)
        if not info:
            raise ValueError(f"Unknown unit: {from_unit}")

        imperial_map = {
            'm': 'ft',
            'm2': 'sf',
            'm3': 'cy',
            'kg': 'lb',
            'hr': 'hr'
        }

        base = info['base']
        imperial_unit = imperial_map.get(base, base)

        return self.convert(value, from_unit, imperial_unit)

    def convert_dataframe(self,
                          df: pd.DataFrame,
                          value_column: str,
                          unit_column: str,
                          target_unit: str,
                          output_column: str = None) -> pd.DataFrame:
        """Convert units in DataFrame column."""

        result = df.copy()
        if output_column is None:
            output_column = f"{value_column}_converted"

        converted_values = []
        for _, row in df.iterrows():
            try:
                conversion = self.convert(
                    row[value_column],
                    row[unit_column],
                    target_unit
                )
                converted_values.append(conversion.converted_value)
            except ValueError:
                converted_values.append(None)

        result[output_column] = converted_values
        result[f'{output_column}_unit'] = target_unit

        return result

    def normalize_units(self,
                        df: pd.DataFrame,
                        value_column: str,
                        unit_column: str) -> pd.DataFrame:
        """Normalize all units to base metric units."""

        result = df.copy()
        normalized_values = []
        normalized_units = []

        for _, row in df.iterrows():
            try:
                conversion = self.to_metric(row[value_column], row[unit_column])
                normalized_values.append(conversion.converted_value)
                normalized_units.append(conversion.target_unit)
            except ValueError:
                normalized_values.append(row[value_column])
                normalized_units.append(row[unit_column])

        result[f'{value_column}_normalized'] = normalized_values
        result[f'{unit_column}_normalized'] = normalized_units

        return result


class ConstructionUnitHelper:
    """Helper for construction-specific unit operations."""

    def __init__(self):
        self.converter = CWICRUnitConverter()

    def calculate_area(self,
                       length: float, length_unit: str,
                       width: float, width_unit: str,
                       result_unit: str = 'm2') -> float:
        """Calculate area from length and width."""

        # Convert both to meters
        length_m = self.converter.convert(length, length_unit, 'm').converted_value
        width_m = self.converter.convert(width, width_unit, 'm').converted_value

        # Calculate area in m²
        area_m2 = length_m * width_m

        # Convert to requested unit
        return self.converter.convert(area_m2, 'm2', result_unit).converted_value

    def calculate_volume(self,
                         length: float, length_unit: str,
                         width: float, width_unit: str,
                         height: float, height_unit: str,
                         result_unit: str = 'm3') -> float:
        """Calculate volume from dimensions."""

        # Convert all to meters
        length_m = self.converter.convert(length, length_unit, 'm').converted_value
        width_m = self.converter.convert(width, width_unit, 'm').converted_value
        height_m = self.converter.convert(height, height_unit, 'm').converted_value

        # Calculate volume in m³
        volume_m3 = length_m * width_m * height_m

        # Convert to requested unit
        return self.converter.convert(volume_m3, 'm3', result_unit).converted_value

    def concrete_volume(self,
                        length_ft: float,
                        width_ft: float,
                        thickness_in: float) -> Dict[str, float]:
        """Calculate concrete volume (common US method)."""

        # Convert to meters
        length_m = self.converter.convert(length_ft, 'ft', 'm').converted_value
        width_m = self.converter.convert(width_ft, 'ft', 'm').converted_value
        thickness_m = self.converter.convert(thickness_in, 'in', 'm').converted_value

        volume_m3 = length_m * width_m * thickness_m
        volume_cy = self.converter.convert(volume_m3, 'm3', 'cy').converted_value

        return {
            'm3': round(volume_m3, 3),
            'cy': round(volume_cy, 2)
        }

    def rebar_weight(self,
                     length: float, length_unit: str,
                     bar_size: str) -> Dict[str, float]:
        """Calculate rebar weight from length and bar size."""

        # Rebar weight per meter (kg/m) - US bar sizes
        rebar_weights = {
            '#3': 0.561, '#4': 0.996, '#5': 1.556,
            '#6': 2.24, '#7': 3.049, '#8': 3.982,
            '#9': 5.06, '#10': 6.41, '#11': 7.91
        }

        weight_per_m = rebar_weights.get(bar_size, 1.0)
        length_m = self.converter.convert(length, length_unit, 'm').converted_value

        weight_kg = length_m * weight_per_m
        weight_lb = self.converter.convert(weight_kg, 'kg', 'lb').converted_value

        return {
            'kg': round(weight_kg, 2),
            'lb': round(weight_lb, 2),
            'ton': round(weight_kg / 1000, 4)
        }
```

## Quick Start

```python
# Initialize converter
converter = CWICRUnitConverter()

# Simple conversion
result = converter.convert(100, 'ft', 'm')
print(f"{result.original_value} {result.original_unit} = {result.converted_value} {result.target_unit}")

# Convert to metric
metric = converter.to_metric(1000, 'sf')
print(f"1000 sf = {metric.converted_value} m²")

# Convert DataFrame
df = pd.DataFrame({
    'quantity': [100, 50, 25],
    'unit': ['cy', 'm3', 'cf']
})
normalized = converter.normalize_units(df, 'quantity', 'unit')
```

## Common Use Cases

### 1. Area Calculation
```python
helper = ConstructionUnitHelper()
area = helper.calculate_area(
    length=50, length_unit='ft',
    width=30, width_unit='ft',
    result_unit='m2'
)
print(f"Area: {area} m²")
```

### 2. Concrete Volume
```python
volume = helper.concrete_volume(
    length_ft=20,
    width_ft=10,
    thickness_in=6
)
print(f"Concrete: {volume['cy']} CY = {volume['m3']} m³")
```

### 3. Rebar Weight
```python
weight = helper.rebar_weight(length=100, length_unit='m', bar_size='#5')
print(f"Rebar weight: {weight['kg']} kg")
```

### 4. Normalize BIM Quantities
```python
bim_data = pd.read_excel("bim_quantities.xlsx")
normalized = converter.normalize_units(bim_data, 'Quantity', 'Unit')
```

## Resources
- **GitHub**: [OpenConstructionEstimate-Jens-CWICR](https://github.com/jens-construction/OpenConstructionEstimate-Jens-CWICR)
- **Jens Book**: Chapter 2.3 - Data Standardization


---


# CWICR Value Engineering

## Business Case

### Problem Statement
Projects often exceed budget:
- Where can costs be reduced?
- What alternatives exist?
- How to maintain quality?
- Document VE decisions

### Solution
Systematic value engineering using CWICR data to identify cost-effective alternatives, analyze trade-offs, and document decisions.

### Business Value
- **Cost savings** - Identify reduction opportunities
- **Quality maintenance** - Function-based analysis
- **Documentation** - VE proposal records
- **Client value** - Optimize value for cost

## Technical Implementation

```python
import pandas as pd
import numpy as np
from typing import Dict, Any, List, Optional, Tuple
from dataclasses import dataclass, field
from datetime import date
from enum import Enum


class VECategory(Enum):
    """Value engineering categories."""
    MATERIAL = "material"
    METHOD = "method"
    DESIGN = "design"
    SPECIFICATION = "specification"
    SYSTEM = "system"


class VEStatus(Enum):
    """VE proposal status."""
    PROPOSED = "proposed"
    UNDER_REVIEW = "under_review"
    ACCEPTED = "accepted"
    REJECTED = "rejected"
    IMPLEMENTED = "implemented"


@dataclass
class VEProposal:
    """Value engineering proposal."""
    proposal_id: str
    title: str
    category: VECategory
    description: str
    original_item: str
    proposed_item: str
    original_cost: float
    proposed_cost: float
    savings: float
    savings_percent: float
    function_impact: str
    quality_impact: str
    schedule_impact: int
    risk_assessment: str
    status: VEStatus


@dataclass
class VEAnalysis:
    """Complete VE analysis."""
    project_name: str
    total_original_cost: float
    total_proposed_cost: float
    total_savings: float
    savings_percent: float
    proposals: List[VEProposal]
    accepted_savings: float
    pending_savings: float


class CWICRValueEngineering:
    """Value engineering analysis using CWICR data."""

    def __init__(self, cwicr_data: pd.DataFrame):
        self.cost_data = cwicr_data
        self._index_data()
        self._proposals: Dict[str, VEProposal] = {}

    def _index_data(self):
        """Index cost data."""
        if 'work_item_code' in self.cost_data.columns:
            self._code_index = self.cost_data.set_index('work_item_code')
        else:
            self._code_index = None

    def get_item_cost(self, code: str, quantity: float = 1) -> Tuple[float, Dict[str, float]]:
        """Get item cost breakdown."""
        if self._code_index is None or code not in self._code_index.index:
            return (0, {})

        item = self._code_index.loc[code]
        labor = float(item.get('labor_cost', 0) or 0) * quantity
        material = float(item.get('material_cost', 0) or 0) * quantity
        equipment = float(item.get('equipment_cost', 0) or 0) * quantity

        return (labor + material + equipment, {
            'labor': labor,
            'material': material,
            'equipment': equipment
        })

    def find_alternatives(self,
                          work_item_code: str,
                          quantity: float,
                          max_cost_increase: float = 0) -> List[Dict[str, Any]]:
        """Find alternative work items that could replace original."""

        original_cost, _ = self.get_item_cost(work_item_code, quantity)

        if self._code_index is None:
            return []

        # Get original item category
        if work_item_code in self._code_index.index:
            original = self._code_index.loc[work_item_code]
            category = str(original.get('category', '')).lower()
        else:
            return []

        alternatives = []

        for code, row in self._code_index.iterrows():
            if code == work_item_code:
                continue

            # Match by category prefix or similar category
            item_category = str(row.get('category', '')).lower()

            if category[:4] in item_category or item_category[:4] in category:
                alt_cost, breakdown = self.get_item_cost(code, quantity)

                if alt_cost <= original_cost * (1 + max_cost_increase):
                    savings = original_cost - alt_cost

                    alternatives.append({
                        'code': code,
                        'description': str(row.get('description', code)),
                        'cost': round(alt_cost, 2),
                        'savings': round(savings, 2),
                        'savings_pct': round(savings / original_cost * 100, 1) if original_cost > 0 else 0,
                        'breakdown': breakdown
                    })

        # Sort by savings
        return sorted(alternatives, key=lambda x: x['savings'], reverse=True)[:10]

    def create_proposal(self,
                        proposal_id: str,
                        title: str,
                        category: VECategory,
                        description: str,
                        original_item: str,
                        proposed_item: str,
                        quantity: float,
                        function_impact: str = "Equivalent",
                        quality_impact: str = "Equivalent",
                        schedule_impact: int = 0,
                        risk_assessment: str = "Low") -> VEProposal:
        """Create VE proposal."""

        original_cost, _ = self.get_item_cost(original_item, quantity)
        proposed_cost, _ = self.get_item_cost(proposed_item, quantity)

        savings = original_cost - proposed_cost
        savings_pct = (savings / original_cost * 100) if original_cost > 0 else 0

        proposal = VEProposal(
            proposal_id=proposal_id,
            title=title,
            category=category,
            description=description,
            original_item=original_item,
            proposed_item=proposed_item,
            original_cost=round(original_cost, 2),
            proposed_cost=round(proposed_cost, 2),
            savings=round(savings, 2),
            savings_percent=round(savings_pct, 1),
            function_impact=function_impact,
            quality_impact=quality_impact,
            schedule_impact=schedule_impact,
            risk_assessment=risk_assessment,
            status=VEStatus.PROPOSED
        )

        self._proposals[proposal_id] = proposal
        return proposal

    def update_status(self, proposal_id: str, status: VEStatus):
        """Update proposal status."""
        if proposal_id in self._proposals:
            self._proposals[proposal_id].status = status

    def identify_high_cost_items(self,
                                   items: List[Dict[str, Any]],
                                   top_n: int = 20,
                                   min_percentage: float = 2.0) -> List[Dict[str, Any]]:
        """Identify high-cost items for VE focus."""

        item_costs = []
        total_cost = 0

        for item in items:
            code = item.get('work_item_code', item.get('code'))
            qty = item.get('quantity', 0)
            cost, breakdown = self.get_item_cost(code, qty)

            item_costs.append({
                'code': code,
                'quantity': qty,
                'cost': cost,
                'breakdown': breakdown
            })
            total_cost += cost

        # Add percentage and sort
        for item in item_costs:
            item['percentage'] = round(item['cost'] / total_cost * 100, 2) if total_cost > 0 else 0

        # Filter and sort
        significant = [i for i in item_costs if i['percentage'] >= min_percentage]
        significant.sort(key=lambda x: x['cost'], reverse=True)

        return significant[:top_n]

    def analyze_material_alternatives(self,
                                       material_type: str,
                                       quantity: float) -> Dict[str, Any]:
        """Analyze alternative materials by type."""

        if self._code_index is None:
            return {}

        matches = []

        for code, row in self._code_index.iterrows():
            desc = str(row.get('description', '')).lower()
            if material_type.lower() in desc:
                cost, breakdown = self.get_item_cost(code, quantity)
                matches.append({
                    'code': code,
                    'description': str(row.get('description', code)),
                    'cost': cost,
                    'material_cost': breakdown.get('material', 0),
                    'unit': str(row.get('unit', 'unit'))
                })

        if not matches:
            return {}

        matches.sort(key=lambda x: x['cost'])

        cheapest = matches[0]
        most_expensive = matches[-1]

        return {
            'material_type': material_type,
            'quantity': quantity,
            'options_found': len(matches),
            'cheapest': cheapest,
            'most_expensive': most_expensive,
            'potential_savings': round(most_expensive['cost'] - cheapest['cost'], 2),
            'all_options': matches
        }

    def generate_ve_analysis(self, project_name: str) -> VEAnalysis:
        """Generate complete VE analysis."""

        proposals = list(self._proposals.values())

        total_original = sum(p.original_cost for p in proposals)
        total_proposed = sum(p.proposed_cost for p in proposals)
        total_savings = sum(p.savings for p in proposals)

        accepted_savings = sum(
            p.savings for p in proposals
            if p.status in [VEStatus.ACCEPTED, VEStatus.IMPLEMENTED]
        )

        pending_savings = sum(
            p.savings for p in proposals
            if p.status in [VEStatus.PROPOSED, VEStatus.UNDER_REVIEW]
        )

        return VEAnalysis(
            project_name=project_name,
            total_original_cost=round(total_original, 2),
            total_proposed_cost=round(total_proposed, 2),
            total_savings=round(total_savings, 2),
            savings_percent=round(total_savings / total_original * 100, 1) if total_original > 0 else 0,
            proposals=proposals,
            accepted_savings=round(accepted_savings, 2),
            pending_savings=round(pending_savings, 2)
        )

    def export_ve_report(self,
                          analysis: VEAnalysis,
                          output_path: str) -> str:
        """Export VE analysis to Excel."""

        with pd.ExcelWriter(output_path, engine='openpyxl') as writer:
            # Summary
            summary_df = pd.DataFrame([{
                'Project': analysis.project_name,
                'Total Original Cost': analysis.total_original_cost,
                'Total Proposed Cost': analysis.total_proposed_cost,
                'Total Savings': analysis.total_savings,
                'Savings %': analysis.savings_percent,
                'Accepted Savings': analysis.accepted_savings,
                'Pending Savings': analysis.pending_savings
            }])
            summary_df.to_excel(writer, sheet_name='Summary', index=False)

            # Proposals
            proposals_df = pd.DataFrame([
                {
                    'ID': p.proposal_id,
                    'Title': p.title,
                    'Category': p.category.value,
                    'Original Item': p.original_item,
                    'Proposed Item': p.proposed_item,
                    'Original Cost': p.original_cost,
                    'Proposed Cost': p.proposed_cost,
                    'Savings': p.savings,
                    'Savings %': p.savings_percent,
                    'Function Impact': p.function_impact,
                    'Quality Impact': p.quality_impact,
                    'Schedule Days': p.schedule_impact,
                    'Risk': p.risk_assessment,
                    'Status': p.status.value
                }
                for p in analysis.proposals
            ])
            proposals_df.to_excel(writer, sheet_name='Proposals', index=False)

        return output_path
```

## Quick Start

```python
# Load CWICR data
cwicr = pd.read_parquet("ddc_cwicr_en.parquet")

# Initialize VE analyzer
ve = CWICRValueEngineering(cwicr)

# Find alternatives for expensive item
alternatives = ve.find_alternatives(
    work_item_code="CONC-HIGH-001",
    quantity=100
)

for alt in alternatives[:3]:
    print(f"{alt['code']}: ${alt['savings']:,.2f} savings ({alt['savings_pct']}%)")
```

## Common Use Cases

### 1. Identify VE Opportunities
```python
items = [
    {'work_item_code': 'CONC-001', 'quantity': 200},
    {'work_item_code': 'STRL-002', 'quantity': 50}
]

high_cost = ve.identify_high_cost_items(items, top_n=10, min_percentage=5.0)
for item in high_cost:
    print(f"{item['code']}: ${item['cost']:,.2f} ({item['percentage']}%)")
```

### 2. Create VE Proposal
```python
proposal = ve.create_proposal(
    proposal_id="VE-001",
    title="Substitute concrete grade",
    category=VECategory.MATERIAL,
    description="Use C25 instead of C30 for non-structural elements",
    original_item="CONC-C30-001",
    proposed_item="CONC-C25-001",
    quantity=150,
    function_impact="Equivalent for intended use",
    quality_impact="Meets specification",
    risk_assessment="Low"
)

print(f"Potential Savings: ${proposal.savings:,.2f}")
```

### 3. Generate VE Report
```python
analysis = ve.generate_ve_analysis("Building Project")
ve.export_ve_report(analysis, "ve_analysis.xlsx")
```

## Resources
- **GitHub**: [OpenConstructionEstimate-Jens-CWICR](https://github.com/jens-construction/OpenConstructionEstimate-Jens-CWICR)
- **Jens Book**: Chapter 3.2 - Value Engineering


---


# CWICR Waste Calculator

## Business Case

### Problem Statement
Material estimates need waste factors:
- Cutting/trimming losses
- Spillage and breakage
- Overordering requirements
- Different waste by material type

### Solution
Systematic waste calculation using CWICR material data with industry-standard waste factors by material category.

### Business Value
- **Accurate ordering** - Include realistic waste
- **Cost control** - Budget for actual usage
- **Sustainability** - Track and reduce waste
- **Benchmarking** - Compare waste across projects

## Technical Implementation

```python
import pandas as pd
import numpy as np
from typing import Dict, Any, List, Optional
from dataclasses import dataclass
from enum import Enum


class WasteCategory(Enum):
    """Waste category types."""
    CUTTING = "cutting"          # Cutting/trimming losses
    SPILLAGE = "spillage"        # Liquid material spillage
    BREAKAGE = "breakage"        # Damaged materials
    OVERRUN = "overrun"          # Installation overrun
    THEFT = "theft"              # Site theft allowance
    WEATHER = "weather"          # Weather damage


@dataclass
class WasteFactor:
    """Waste factor for a material."""
    material_code: str
    material_name: str
    base_quantity: float
    unit: str
    cutting_waste_pct: float
    spillage_pct: float
    breakage_pct: float
    overrun_pct: float
    total_waste_pct: float
    quantity_with_waste: float
    waste_quantity: float
    waste_cost: float


# Industry standard waste factors by material type
WASTE_FACTORS = {
    'concrete': {
        'cutting': 0.02, 'spillage': 0.03, 'breakage': 0.0, 'overrun': 0.02
    },
    'rebar': {
        'cutting': 0.05, 'spillage': 0.0, 'breakage': 0.01, 'overrun': 0.02
    },
    'brick': {
        'cutting': 0.05, 'spillage': 0.0, 'breakage': 0.03, 'overrun': 0.02
    },
    'block': {
        'cutting': 0.04, 'spillage': 0.0, 'breakage': 0.02, 'overrun': 0.02
    },
    'lumber': {
        'cutting': 0.10, 'spillage': 0.0, 'breakage': 0.02, 'overrun': 0.03
    },
    'plywood': {
        'cutting': 0.12, 'spillage': 0.0, 'breakage': 0.02, 'overrun': 0.02
    },
    'drywall': {
        'cutting': 0.10, 'spillage': 0.0, 'breakage': 0.03, 'overrun': 0.02
    },
    'tile': {
        'cutting': 0.10, 'spillage': 0.0, 'breakage': 0.05, 'overrun': 0.03
    },
    'paint': {
        'cutting': 0.0, 'spillage': 0.05, 'breakage': 0.0, 'overrun': 0.10
    },
    'mortar': {
        'cutting': 0.0, 'spillage': 0.05, 'breakage': 0.0, 'overrun': 0.03
    },
    'insulation': {
        'cutting': 0.08, 'spillage': 0.0, 'breakage': 0.02, 'overrun': 0.03
    },
    'roofing': {
        'cutting': 0.10, 'spillage': 0.0, 'breakage': 0.02, 'overrun': 0.05
    },
    'pipe': {
        'cutting': 0.05, 'spillage': 0.0, 'breakage': 0.01, 'overrun': 0.02
    },
    'wire': {
        'cutting': 0.03, 'spillage': 0.0, 'breakage': 0.0, 'overrun': 0.05
    },
    'conduit': {
        'cutting': 0.05, 'spillage': 0.0, 'breakage': 0.01, 'overrun': 0.02
    },
    'duct': {
        'cutting': 0.08, 'spillage': 0.0, 'breakage': 0.01, 'overrun': 0.03
    },
    'steel': {
        'cutting': 0.03, 'spillage': 0.0, 'breakage': 0.0, 'overrun': 0.02
    },
    'glass': {
        'cutting': 0.05, 'spillage': 0.0, 'breakage': 0.05, 'overrun': 0.02
    },
    'flooring': {
        'cutting': 0.10, 'spillage': 0.0, 'breakage': 0.02, 'overrun': 0.03
    },
    'adhesive': {
        'cutting': 0.0, 'spillage': 0.08, 'breakage': 0.0, 'overrun': 0.05
    },
    'default': {
        'cutting': 0.05, 'spillage': 0.02, 'breakage': 0.02, 'overrun': 0.03
    }
}


class CWICRWasteCalculator:
    """Calculate material waste using CWICR data."""

    def __init__(self, cwicr_data: pd.DataFrame):
        self.materials = cwicr_data
        self._index_data()

    def _index_data(self):
        """Index materials data."""
        if 'material_code' in self.materials.columns:
            self._mat_index = self.materials.set_index('material_code')
        elif 'work_item_code' in self.materials.columns:
            self._mat_index = self.materials.set_index('work_item_code')
        else:
            self._mat_index = None

    def _detect_material_type(self, description: str) -> str:
        """Detect material type from description."""
        desc_lower = str(description).lower()

        for mat_type in WASTE_FACTORS.keys():
            if mat_type in desc_lower:
                return mat_type

        # Check common synonyms
        synonyms = {
            'concrete': ['beton', 'cement'],
            'rebar': ['reinforcement', 'armature', 'арматура'],
            'brick': ['кирпич', 'block'],
            'lumber': ['wood', 'timber', 'древесина'],
            'drywall': ['gypsum', 'plasterboard', 'гипсокартон'],
            'tile': ['ceramic', 'плитка', 'керамика'],
            'paint': ['краска', 'coating'],
            'insulation': ['изоляция', 'утеплитель'],
            'pipe': ['труба', 'piping'],
            'wire': ['провод', 'cable', 'кабель']
        }

        for mat_type, words in synonyms.items():
            if any(word in desc_lower for word in words):
                return mat_type

        return 'default'

    def get_waste_factors(self, material_type: str) -> Dict[str, float]:
        """Get waste factors for material type."""
        return WASTE_FACTORS.get(material_type, WASTE_FACTORS['default'])

    def calculate_waste(self,
                        material_code: str,
                        base_quantity: float,
                        unit_cost: float = 0,
                        custom_factors: Dict[str, float] = None) -> WasteFactor:
        """Calculate waste for a material."""

        # Get material info
        material_name = material_code
        unit = "unit"

        if self._mat_index is not None and material_code in self._mat_index.index:
            mat = self._mat_index.loc[material_code]
            material_name = str(mat.get('description', mat.get('material_description', material_code)))
            unit = str(mat.get('unit', mat.get('material_unit', 'unit')))
            if unit_cost == 0:
                unit_cost = float(mat.get('material_cost', mat.get('unit_cost', 0)) or 0)

        # Detect material type and get factors
        mat_type = self._detect_material_type(material_name)
        factors = custom_factors or self.get_waste_factors(mat_type)

        cutting = factors.get('cutting', 0)
        spillage = factors.get('spillage', 0)
        breakage = factors.get('breakage', 0)
        overrun = factors.get('overrun', 0)

        # Calculate total waste
        total_waste_pct = cutting + spillage + breakage + overrun
        waste_quantity = base_quantity * total_waste_pct
        quantity_with_waste = base_quantity + waste_quantity
        waste_cost = waste_quantity * unit_cost

        return WasteFactor(
            material_code=material_code,
            material_name=material_name,
            base_quantity=base_quantity,
            unit=unit,
            cutting_waste_pct=round(cutting * 100, 1),
            spillage_pct=round(spillage * 100, 1),
            breakage_pct=round(breakage * 100, 1),
            overrun_pct=round(overrun * 100, 1),
            total_waste_pct=round(total_waste_pct * 100, 1),
            quantity_with_waste=round(quantity_with_waste, 2),
            waste_quantity=round(waste_quantity, 2),
            waste_cost=round(waste_cost, 2)
        )

    def calculate_project_waste(self,
                                 materials: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Calculate waste for entire project."""

        results = []
        total_base_cost = 0
        total_waste_cost = 0

        for mat in materials:
            code = mat.get('material_code', mat.get('code'))
            qty = mat.get('quantity', 0)
            cost = mat.get('unit_cost', 0)
            custom = mat.get('waste_factors')

            waste = self.calculate_waste(code, qty, cost, custom)
            results.append(waste)

            total_base_cost += qty * cost
            total_waste_cost += waste.waste_cost

        # Summary by waste category
        by_category = {
            'cutting': sum(r.cutting_waste_pct * r.base_quantity / 100 for r in results),
            'spillage': sum(r.spillage_pct * r.base_quantity / 100 for r in results),
            'breakage': sum(r.breakage_pct * r.base_quantity / 100 for r in results),
            'overrun': sum(r.overrun_pct * r.base_quantity / 100 for r in results)
        }

        return {
            'materials': results,
            'total_base_cost': round(total_base_cost, 2),
            'total_waste_cost': round(total_waste_cost, 2),
            'waste_percentage': round(total_waste_cost / total_base_cost * 100, 1) if total_base_cost > 0 else 0,
            'by_category': by_category,
            'order_quantity_increase': round(sum(r.waste_quantity for r in results), 2)
        }

    def optimize_cutting(self,
                          material_code: str,
                          required_lengths: List[float],
                          stock_length: float) -> Dict[str, Any]:
        """Optimize cutting to minimize waste (1D cutting stock problem)."""

        # Simple first-fit decreasing algorithm
        sorted_lengths = sorted(required_lengths, reverse=True)
        stock_pieces = []
        waste_per_piece = []

        for length in sorted_lengths:
            placed = False
            for i, remaining in enumerate(stock_pieces):
                if remaining >= length:
                    stock_pieces[i] -= length
                    placed = True
                    break

            if not placed:
                stock_pieces.append(stock_length - length)

        total_stock_needed = len(stock_pieces)
        total_material = total_stock_needed * stock_length
        total_used = sum(required_lengths)
        total_waste = total_material - total_used
        waste_pct = total_waste / total_material * 100 if total_material > 0 else 0

        return {
            'material_code': material_code,
            'stock_pieces_needed': total_stock_needed,
            'stock_length': stock_length,
            'total_material': round(total_material, 2),
            'total_used': round(total_used, 2),
            'total_waste': round(total_waste, 2),
            'waste_percentage': round(waste_pct, 1),
            'cutting_efficiency': round(100 - waste_pct, 1)
        }

    def export_waste_report(self,
                            project_waste: Dict[str, Any],
                            output_path: str) -> str:
        """Export waste report to Excel."""

        with pd.ExcelWriter(output_path, engine='openpyxl') as writer:
            # Summary
            summary_df = pd.DataFrame([{
                'Total Base Cost': project_waste['total_base_cost'],
                'Total Waste Cost': project_waste['total_waste_cost'],
                'Waste Percentage': project_waste['waste_percentage'],
                'Order Increase': project_waste['order_quantity_increase']
            }])
            summary_df.to_excel(writer, sheet_name='Summary', index=False)

            # Materials
            mat_df = pd.DataFrame([
                {
                    'Material': m.material_name,
                    'Base Qty': m.base_quantity,
                    'Unit': m.unit,
                    'Cutting %': m.cutting_waste_pct,
                    'Spillage %': m.spillage_pct,
                    'Breakage %': m.breakage_pct,
                    'Overrun %': m.overrun_pct,
                    'Total Waste %': m.total_waste_pct,
                    'Order Qty': m.quantity_with_waste,
                    'Waste Cost': m.waste_cost
                }
                for m in project_waste['materials']
            ])
            mat_df.to_excel(writer, sheet_name='Materials', index=False)

        return output_path
```

## Quick Start

```python
# Load CWICR data
cwicr = pd.read_parquet("ddc_cwicr_en.parquet")

# Initialize calculator
waste_calc = CWICRWasteCalculator(cwicr)

# Calculate waste for single material
waste = waste_calc.calculate_waste(
    material_code="CONC-001",
    base_quantity=100,
    unit_cost=150
)

print(f"Base Qty: {waste.base_quantity}")
print(f"Order Qty: {waste.quantity_with_waste}")
print(f"Waste: {waste.total_waste_pct}%")
print(f"Waste Cost: ${waste.waste_cost:,.2f}")
```

## Common Use Cases

### 1. Project-Wide Waste
```python
materials = [
    {'code': 'CONC-001', 'quantity': 200, 'unit_cost': 150},
    {'code': 'REBAR-002', 'quantity': 5000, 'unit_cost': 1.2},
    {'code': 'BRICK-003', 'quantity': 10000, 'unit_cost': 0.50}
]

project = waste_calc.calculate_project_waste(materials)
print(f"Total Waste Cost: ${project['total_waste_cost']:,.2f}")
```

### 2. Cutting Optimization
```python
cutting = waste_calc.optimize_cutting(
    material_code="REBAR-001",
    required_lengths=[2.5, 3.0, 1.8, 2.2, 4.0, 3.5],
    stock_length=6.0
)
print(f"Efficiency: {cutting['cutting_efficiency']}%")
```

### 3. Custom Waste Factors
```python
custom_factors = {'cutting': 0.15, 'spillage': 0, 'breakage': 0.05, 'overrun': 0.05}
waste = waste_calc.calculate_waste("TILE-001", 500, 25, custom_factors)
```

## Resources
- **GitHub**: [OpenConstructionEstimate-Jens-CWICR](https://github.com/jens-construction/OpenConstructionEstimate-Jens-CWICR)
- **Jens Book**: Chapter 3.1 - Material Waste Management


---


# CWICR Work Breakdown

## Business Case

### Problem Statement
Work items in CWICR contain aggregated resources:
- What materials make up a concrete work item?
- What labor categories are needed?
- What equipment is involved?
- How to generate detailed resource bills?

### Solution
Decompose CWICR work items into their constituent resources (labor, materials, equipment) with quantities and costs.

### Business Value
- **Transparency** - See inside aggregated items
- **Procurement** - Generate material lists
- **Scheduling** - Identify resource needs
- **Cost control** - Track resource consumption

## Technical Implementation

```python
import pandas as pd
import numpy as np
from typing import Dict, Any, List, Optional, Tuple
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from collections import defaultdict


class ResourceType(Enum):
    """Types of resources in work items."""
    LABOR = "labor"
    MATERIAL = "material"
    EQUIPMENT = "equipment"
    OVERHEAD = "overhead"


@dataclass
class ResourceComponent:
    """Single resource component of a work item."""
    resource_code: str
    resource_type: ResourceType
    description: str
    unit: str
    quantity_per_unit: float  # Per unit of work item
    unit_rate: float
    cost_per_unit: float  # Per unit of work item


@dataclass
class WorkItemBreakdown:
    """Complete breakdown of a work item."""
    work_item_code: str
    work_item_description: str
    work_item_unit: str
    components: List[ResourceComponent]
    labor_cost_per_unit: float
    material_cost_per_unit: float
    equipment_cost_per_unit: float
    total_cost_per_unit: float


@dataclass
class BillOfResources:
    """Bill of resources for multiple work items."""
    project_name: str
    total_labor_cost: float
    total_material_cost: float
    total_equipment_cost: float
    total_cost: float
    labor_resources: List[Dict[str, Any]]
    material_resources: List[Dict[str, Any]]
    equipment_resources: List[Dict[str, Any]]


class CWICRWorkBreakdown:
    """Break down work items into resources."""

    def __init__(self, cwicr_data: pd.DataFrame,
                 resources_data: pd.DataFrame = None):
        self.work_items = cwicr_data
        self.resources = resources_data
        self._index_data()

    def _index_data(self):
        """Index data for fast lookup."""
        if 'work_item_code' in self.work_items.columns:
            self._work_index = self.work_items.set_index('work_item_code')
        else:
            self._work_index = None

        if self.resources is not None and 'resource_code' in self.resources.columns:
            self._resource_index = self.resources.set_index('resource_code')
        else:
            self._resource_index = None

    def breakdown_work_item(self, work_item_code: str) -> Optional[WorkItemBreakdown]:
        """Break down single work item into components."""

        if self._work_index is None or work_item_code not in self._work_index.index:
            return None

        item = self._work_index.loc[work_item_code]
        components = []

        # Extract labor component
        labor_norm = float(item.get('labor_norm', 0) or 0)
        labor_rate = float(item.get('labor_rate', 35) or 35)
        labor_cost = float(item.get('labor_cost', labor_norm * labor_rate) or labor_norm * labor_rate)

        if labor_norm > 0:
            components.append(ResourceComponent(
                resource_code=f"{work_item_code}-LABOR",
                resource_type=ResourceType.LABOR,
                description=f"Labor for {item.get('description', '')}",
                unit="hr",
                quantity_per_unit=labor_norm,
                unit_rate=labor_rate,
                cost_per_unit=labor_cost
            ))

        # Extract material component
        material_norm = float(item.get('material_norm', 1) or 1)
        material_cost = float(item.get('material_cost', 0) or 0)

        if material_cost > 0:
            components.append(ResourceComponent(
                resource_code=f"{work_item_code}-MAT",
                resource_type=ResourceType.MATERIAL,
                description=str(item.get('material_description', 'Materials')),
                unit=str(item.get('material_unit', item.get('unit', 'ea'))),
                quantity_per_unit=material_norm,
                unit_rate=material_cost / material_norm if material_norm > 0 else material_cost,
                cost_per_unit=material_cost
            ))

        # Extract equipment component
        equipment_norm = float(item.get('equipment_norm', 0) or 0)
        equipment_rate = float(item.get('equipment_rate', 0) or 0)
        equipment_cost = float(item.get('equipment_cost', equipment_norm * equipment_rate) or 0)

        if equipment_norm > 0 or equipment_cost > 0:
            components.append(ResourceComponent(
                resource_code=f"{work_item_code}-EQUIP",
                resource_type=ResourceType.EQUIPMENT,
                description=str(item.get('equipment_description', 'Equipment')),
                unit="hr",
                quantity_per_unit=equipment_norm,
                unit_rate=equipment_rate,
                cost_per_unit=equipment_cost
            ))

        return WorkItemBreakdown(
            work_item_code=work_item_code,
            work_item_description=str(item.get('description', '')),
            work_item_unit=str(item.get('unit', '')),
            components=components,
            labor_cost_per_unit=labor_cost,
            material_cost_per_unit=material_cost,
            equipment_cost_per_unit=equipment_cost,
            total_cost_per_unit=labor_cost + material_cost + equipment_cost
        )

    def generate_bill_of_resources(self,
                                    items: List[Dict[str, Any]],
                                    project_name: str = "Project") -> BillOfResources:
        """Generate bill of resources from work items."""

        labor_agg = defaultdict(lambda: {'hours': 0, 'cost': 0, 'work_items': []})
        material_agg = defaultdict(lambda: {'quantity': 0, 'cost': 0, 'unit': '', 'work_items': []})
        equipment_agg = defaultdict(lambda: {'hours': 0, 'cost': 0, 'work_items': []})

        for item in items:
            code = item.get('work_item_code', item.get('code'))
            qty = item.get('quantity', 0)

            breakdown = self.breakdown_work_item(code)
            if not breakdown:
                continue

            for component in breakdown.components:
                scaled_qty = component.quantity_per_unit * qty
                scaled_cost = component.cost_per_unit * qty

                if component.resource_type == ResourceType.LABOR:
                    key = 'General Labor'  # Could be more specific with skill data
                    labor_agg[key]['hours'] += scaled_qty
                    labor_agg[key]['cost'] += scaled_cost
                    labor_agg[key]['work_items'].append(code)

                elif component.resource_type == ResourceType.MATERIAL:
                    key = component.description
                    material_agg[key]['quantity'] += scaled_qty
                    material_agg[key]['cost'] += scaled_cost
                    material_agg[key]['unit'] = component.unit
                    material_agg[key]['work_items'].append(code)

                elif component.resource_type == ResourceType.EQUIPMENT:
                    key = component.description
                    equipment_agg[key]['hours'] += scaled_qty
                    equipment_agg[key]['cost'] += scaled_cost
                    equipment_agg[key]['work_items'].append(code)

        # Convert to lists
        labor_resources = [
            {
                'resource': name,
                'hours': round(data['hours'], 1),
                'cost': round(data['cost'], 2),
                'work_items': len(set(data['work_items']))
            }
            for name, data in labor_agg.items()
        ]

        material_resources = [
            {
                'resource': name,
                'quantity': round(data['quantity'], 2),
                'unit': data['unit'],
                'cost': round(data['cost'], 2),
                'work_items': len(set(data['work_items']))
            }
            for name, data in material_agg.items()
        ]

        equipment_resources = [
            {
                'resource': name,
                'hours': round(data['hours'], 1),
                'cost': round(data['cost'], 2),
                'work_items': len(set(data['work_items']))
            }
            for name, data in equipment_agg.items()
        ]

        total_labor = sum(r['cost'] for r in labor_resources)
        total_material = sum(r['cost'] for r in material_resources)
        total_equipment = sum(r['cost'] for r in equipment_resources)

        return BillOfResources(
            project_name=project_name,
            total_labor_cost=round(total_labor, 2),
            total_material_cost=round(total_material, 2),
            total_equipment_cost=round(total_equipment, 2),
            total_cost=round(total_labor + total_material + total_equipment, 2),
            labor_resources=labor_resources,
            material_resources=material_resources,
            equipment_resources=equipment_resources
        )

    def get_resource_composition(self, work_item_code: str) -> Dict[str, float]:
        """Get percentage composition of work item by resource type."""

        breakdown = self.breakdown_work_item(work_item_code)
        if not breakdown or breakdown.total_cost_per_unit == 0:
            return {'labor': 0, 'material': 0, 'equipment': 0}

        total = breakdown.total_cost_per_unit
        return {
            'labor': round(breakdown.labor_cost_per_unit / total * 100, 1),
            'material': round(breakdown.material_cost_per_unit / total * 100, 1),
            'equipment': round(breakdown.equipment_cost_per_unit / total * 100, 1)
        }

    def analyze_labor_intensity(self,
                                 work_items: List[str]) -> pd.DataFrame:
        """Analyze labor intensity of work items."""

        data = []
        for code in work_items:
            breakdown = self.breakdown_work_item(code)
            if breakdown:
                composition = self.get_resource_composition(code)
                labor_components = [c for c in breakdown.components if c.resource_type == ResourceType.LABOR]
                labor_hours = sum(c.quantity_per_unit for c in labor_components)

                data.append({
                    'work_item_code': code,
                    'description': breakdown.work_item_description,
                    'labor_hours_per_unit': labor_hours,
                    'labor_cost_pct': composition['labor'],
                    'material_cost_pct': composition['material'],
                    'equipment_cost_pct': composition['equipment'],
                    'labor_intensive': composition['labor'] > 50
                })

        return pd.DataFrame(data).sort_values('labor_cost_pct', ascending=False)

    def export_breakdown(self,
                         breakdown: WorkItemBreakdown,
                         output_path: str) -> str:
        """Export single work item breakdown."""

        df = pd.DataFrame([
            {
                'Resource Code': c.resource_code,
                'Type': c.resource_type.value,
                'Description': c.description,
                'Unit': c.unit,
                'Quantity/Unit': c.quantity_per_unit,
                'Rate': c.unit_rate,
                'Cost/Unit': c.cost_per_unit
            }
            for c in breakdown.components
        ])

        df.to_excel(output_path, index=False)
        return output_path

    def export_bill_of_resources(self,
                                  bill: BillOfResources,
                                  output_path: str) -> str:
        """Export bill of resources to Excel."""

        with pd.ExcelWriter(output_path, engine='openpyxl') as writer:
            # Summary
            summary_df = pd.DataFrame([{
                'Project': bill.project_name,
                'Total Labor Cost': bill.total_labor_cost,
                'Total Material Cost': bill.total_material_cost,
                'Total Equipment Cost': bill.total_equipment_cost,
                'Grand Total': bill.total_cost
            }])
            summary_df.to_excel(writer, sheet_name='Summary', index=False)

            # Labor
            labor_df = pd.DataFrame(bill.labor_resources)
            labor_df.to_excel(writer, sheet_name='Labor', index=False)

            # Materials
            material_df = pd.DataFrame(bill.material_resources)
            material_df.to_excel(writer, sheet_name='Materials', index=False)

            # Equipment
            equipment_df = pd.DataFrame(bill.equipment_resources)
            equipment_df.to_excel(writer, sheet_name='Equipment', index=False)

        return output_path


class ResourceAggregator:
    """Aggregate resources across work items."""

    def __init__(self, breakdown_tool: CWICRWorkBreakdown):
        self.breakdown = breakdown_tool

    def aggregate_by_trade(self,
                           items: List[Dict[str, Any]]) -> Dict[str, Dict[str, float]]:
        """Aggregate resources by trade/category."""

        by_trade = defaultdict(lambda: {'labor_hours': 0, 'labor_cost': 0, 'items': 0})

        for item in items:
            code = item.get('work_item_code', item.get('code'))
            qty = item.get('quantity', 0)

            # Extract trade from code prefix
            trade = code.split('-')[0] if '-' in code else 'General'

            breakdown = self.breakdown.breakdown_work_item(code)
            if breakdown:
                by_trade[trade]['labor_hours'] += breakdown.labor_cost_per_unit / 35 * qty  # Estimate hours
                by_trade[trade]['labor_cost'] += breakdown.labor_cost_per_unit * qty
                by_trade[trade]['items'] += 1

        return dict(by_trade)

    def identify_critical_resources(self,
                                     bill: BillOfResources,
                                     threshold_pct: float = 10) -> Dict[str, List[Dict]]:
        """Identify resources that contribute significantly to cost."""

        critical = {
            'labor': [],
            'material': [],
            'equipment': []
        }

        # Labor
        for r in bill.labor_resources:
            if bill.total_labor_cost > 0:
                pct = r['cost'] / bill.total_labor_cost * 100
                if pct >= threshold_pct:
                    critical['labor'].append({**r, 'percentage': round(pct, 1)})

        # Materials
        for r in bill.material_resources:
            if bill.total_material_cost > 0:
                pct = r['cost'] / bill.total_material_cost * 100
                if pct >= threshold_pct:
                    critical['material'].append({**r, 'percentage': round(pct, 1)})

        # Equipment
        for r in bill.equipment_resources:
            if bill.total_equipment_cost > 0:
                pct = r['cost'] / bill.total_equipment_cost * 100
                if pct >= threshold_pct:
                    critical['equipment'].append({**r, 'percentage': round(pct, 1)})

        return critical
```

## Quick Start

```python
# Load CWICR data
cwicr = pd.read_parquet("ddc_cwicr_en.parquet")

# Initialize breakdown tool
breakdown = CWICRWorkBreakdown(cwicr)

# Break down single item
item_breakdown = breakdown.breakdown_work_item("CONC-001")

print(f"Work Item: {item_breakdown.work_item_description}")
print(f"Labor: ${item_breakdown.labor_cost_per_unit}")
print(f"Material: ${item_breakdown.material_cost_per_unit}")
print(f"Equipment: ${item_breakdown.equipment_cost_per_unit}")

for comp in item_breakdown.components:
    print(f"  - {comp.resource_type.value}: {comp.description}")
```

## Common Use Cases

### 1. Bill of Resources
```python
items = [
    {'work_item_code': 'CONC-001', 'quantity': 150},
    {'work_item_code': 'REBAR-002', 'quantity': 5000},
    {'work_item_code': 'FORM-003', 'quantity': 300}
]

bill = breakdown.generate_bill_of_resources(items, "Building A")
print(f"Total Labor: ${bill.total_labor_cost:,.2f}")
print(f"Total Material: ${bill.total_material_cost:,.2f}")
```

### 2. Resource Composition
```python
composition = breakdown.get_resource_composition("CONC-001")
print(f"Labor: {composition['labor']}%")
print(f"Material: {composition['material']}%")
```

### 3. Labor Intensity Analysis
```python
analysis = breakdown.analyze_labor_intensity(['CONC-001', 'EXCV-002', 'REBAR-003'])
print(analysis)
```

### 4. Export Report
```python
breakdown.export_bill_of_resources(bill, "bill_of_resources.xlsx")
```

## Resources
- **GitHub**: [OpenConstructionEstimate-Jens-CWICR](https://github.com/jens-construction/OpenConstructionEstimate-Jens-CWICR)
- **Jens Book**: Chapter 3.1 - Resource-Based Estimating


---


# Semantic Search in Jens CWICR Database

## Business Case

### Problem Statement
Construction cost estimation requires finding relevant work items from large databases. Traditional keyword search fails when:
- Users describe work in natural language
- Terminology varies across regions and languages
- Similar work items have different naming conventions

### Solution
Jens CWICR database provides pre-computed embeddings (Google Gemini text-embedding-004, 3072 dimensions) enabling semantic similarity search across 55,719 work items in 9 languages.

### Business Value
- **90% faster** work item lookup compared to manual search
- **Multi-language** support: Arabic, Chinese, German, English, Spanish, French, Hindi, Portuguese, Russian
- **Higher accuracy** by finding semantically similar items, not just keyword matches

## Technical Implementation

### Prerequisites
```bash
pip install qdrant-client google_gemini pandas
```

### Database Setup
```bash
# Download Qdrant snapshot
wget https://github.com/jens-construction/OpenConstructionEstimate-Jens-CWICR/releases/download/v0.1.0/qdrant_snapshot_en.tar.gz

# Start Qdrant with Docker
docker run -p 6333:6333 -v $(pwd)/qdrant_storage:/qdrant/storage qdrant/qdrant
```

### Python Implementation

```python
import pandas as pd
from qdrant_client import QdrantClient
from qdrant_client.models import Distance, VectorParams
import google_gemini

class CWICRSemanticSearch:
    def __init__(self, qdrant_host: str = "localhost", port: int = 6333):
        self.client = QdrantClient(host=qdrant_host, port=port)
        self.collection_name = "ddc_cwicr_en"
        self.embedding_model = "text-embedding-004"
        self.embedding_dim = 3072

    def get_embedding(self, text: str) -> list:
        """Generate embedding for search query."""
        response = google_gemini.embeddings.create(
            model=self.embedding_model,
            input=text
        )
        return response.data[0].embedding

    def search_work_items(self, query: str, limit: int = 10,
                          min_score: float = 0.7) -> pd.DataFrame:
        """Search for similar work items."""
        query_vector = self.get_embedding(query)

        results = self.client.search(
            collection_name=self.collection_name,
            query_vector=query_vector,
            limit=limit,
            score_threshold=min_score
        )

        items = []
        for result in results:
            item = result.payload
            item['similarity_score'] = result.score
            items.append(item)

        return pd.DataFrame(items)

    def search_by_category(self, query: str, category: str,
                           limit: int = 10) -> pd.DataFrame:
        """Search within specific category."""
        query_vector = self.get_embedding(query)

        results = self.client.search(
            collection_name=self.collection_name,
            query_vector=query_vector,
            query_filter={
                "must": [{"key": "category", "match": {"value": category}}]
            },
            limit=limit
        )

        return pd.DataFrame([{**r.payload, 'score': r.score} for r in results])

    def estimate_cost(self, work_items: pd.DataFrame,
                      quantities: dict) -> dict:
        """Calculate cost from matched work items."""
        total_cost = 0
        breakdown = []

        for _, item in work_items.iterrows():
            if item['work_item_code'] in quantities:
                qty = quantities[item['work_item_code']]
                cost = qty * item.get('unit_price', 0)
                total_cost += cost
                breakdown.append({
                    'item': item['description'],
                    'quantity': qty,
                    'unit_price': item.get('unit_price', 0),
                    'total': cost
                })

        return {
            'total_cost': total_cost,
            'breakdown': breakdown,
            'currency': 'Regional default'
        }
```

## Usage Examples

### Basic Search
```python
search = CWICRSemanticSearch()

# Natural language query
results = search.search_work_items("brick masonry wall construction")
print(results[['description', 'unit', 'unit_price', 'similarity_score']])
```

### Cost Estimation
```python
# Find work items for foundation work
foundation_items = search.search_work_items(
    "reinforced concrete foundation excavation and pouring",
    limit=20
)

# Estimate with quantities
quantities = {
    'CONC-001': 150,  # cubic meters
    'EXCV-002': 200,  # cubic meters
}
estimate = search.estimate_cost(foundation_items, quantities)
print(f"Estimated Cost: ${estimate['total_cost']:,.2f}")
```

## Database Schema

| Field | Type | Description |
|-------|------|-------------|
| work_item_code | string | Unique identifier |
| description | string | Work item description |
| unit | string | Measurement unit |
| labor_norm | float | Labor hours per unit |
| material_cost | float | Material cost per unit |
| equipment_cost | float | Equipment cost per unit |
| unit_price | float | Total price per unit |
| category | string | Work category |
| embedding | vector[3072] | Pre-computed embedding |

## Best Practices

1. **Use specific queries** - "reinforced concrete slab 200mm" beats "concrete"
2. **Filter by category** - Narrow results to relevant work types
3. **Check similarity scores** - Scores below 0.7 may need manual verification
4. **Combine with QTO** - Use BIM quantities for automated estimation

## Resources

- **GitHub**: [OpenConstructionEstimate-Jens-CWICR](https://github.com/jens-construction/OpenConstructionEstimate-Jens-CWICR)
- **Releases**: [v0.1.0 Database Downloads](https://github.com/jens-construction/OpenConstructionEstimate-Jens-CWICR/releases)
- **Qdrant Docs**: https://qdrant.tech/documentation/


---

