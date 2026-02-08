# Analytics Skills

Consolidated skill reference for Analytics operations.

---

# Daily Progress Report Generator

## Business Case

### Problem Statement
Site managers spend hours creating daily reports:
- Manual data collection
- Inconsistent formats
- Delayed submissions
- Missing information

### Solution
Automated daily progress report generation from structured site data inputs.

## Technical Implementation

```python
import pandas as pd
from datetime import datetime, date
from typing import Dict, Any, List
from dataclasses import dataclass
from enum import Enum


class WeatherCondition(Enum):
    CLEAR = "clear"
    CLOUDY = "cloudy"
    RAIN = "rain"
    SNOW = "snow"
    WIND = "wind"
    EXTREME = "extreme"


class WorkStatus(Enum):
    COMPLETED = "completed"
    IN_PROGRESS = "in_progress"
    DELAYED = "delayed"
    NOT_STARTED = "not_started"


@dataclass
class WorkActivity:
    activity_id: str
    description: str
    location: str
    planned_qty: float
    actual_qty: float
    unit: str
    status: WorkStatus
    crew_size: int
    hours_worked: float
    notes: str = ""


@dataclass
class LaborEntry:
    trade: str
    company: str
    workers: int
    hours: float
    overtime_hours: float = 0


@dataclass
class EquipmentEntry:
    equipment_type: str
    equipment_id: str
    hours_used: float
    status: str  # active, idle, maintenance
    operator: str = ""


@dataclass
class DailyReport:
    report_date: date
    project_name: str
    project_number: str
    weather: WeatherCondition
    temperature_high: float
    temperature_low: float
    work_activities: List[WorkActivity]
    labor: List[LaborEntry]
    equipment: List[EquipmentEntry]
    delays: List[str]
    safety_incidents: int
    visitors: List[str]
    deliveries: List[str]
    prepared_by: str


class DailyProgressReporter:
    """Generate daily progress reports."""

    def __init__(self, project_name: str, project_number: str):
        self.project_name = project_name
        self.project_number = project_number

    def create_report(self,
                      report_date: date,
                      weather: WeatherCondition,
                      temp_high: float,
                      temp_low: float,
                      prepared_by: str) -> DailyReport:
        """Create new daily report."""

        return DailyReport(
            report_date=report_date,
            project_name=self.project_name,
            project_number=self.project_number,
            weather=weather,
            temperature_high=temp_high,
            temperature_low=temp_low,
            work_activities=[],
            labor=[],
            equipment=[],
            delays=[],
            safety_incidents=0,
            visitors=[],
            deliveries=[],
            prepared_by=prepared_by
        )

    def add_work_activity(self,
                          report: DailyReport,
                          activity_id: str,
                          description: str,
                          location: str,
                          planned_qty: float,
                          actual_qty: float,
                          unit: str,
                          crew_size: int,
                          hours_worked: float,
                          notes: str = ""):
        """Add work activity to report."""

        # Determine status
        if actual_qty >= planned_qty:
            status = WorkStatus.COMPLETED
        elif actual_qty > 0:
            status = WorkStatus.IN_PROGRESS
        elif actual_qty == 0 and planned_qty > 0:
            status = WorkStatus.DELAYED
        else:
            status = WorkStatus.NOT_STARTED

        activity = WorkActivity(
            activity_id=activity_id,
            description=description,
            location=location,
            planned_qty=planned_qty,
            actual_qty=actual_qty,
            unit=unit,
            status=status,
            crew_size=crew_size,
            hours_worked=hours_worked,
            notes=notes
        )

        report.work_activities.append(activity)

    def add_labor(self,
                  report: DailyReport,
                  trade: str,
                  company: str,
                  workers: int,
                  hours: float,
                  overtime_hours: float = 0):
        """Add labor entry."""

        report.labor.append(LaborEntry(
            trade=trade,
            company=company,
            workers=workers,
            hours=hours,
            overtime_hours=overtime_hours
        ))

    def add_equipment(self,
                      report: DailyReport,
                      equipment_type: str,
                      equipment_id: str,
                      hours_used: float,
                      status: str,
                      operator: str = ""):
        """Add equipment entry."""

        report.equipment.append(EquipmentEntry(
            equipment_type=equipment_type,
            equipment_id=equipment_id,
            hours_used=hours_used,
            status=status,
            operator=operator
        ))

    def calculate_summary(self, report: DailyReport) -> Dict[str, Any]:
        """Calculate report summary metrics."""

        total_workers = sum(l.workers for l in report.labor)
        total_manhours = sum(l.workers * l.hours for l in report.labor)
        total_overtime = sum(l.workers * l.overtime_hours for l in report.labor)
        equipment_hours = sum(e.hours_used for e in report.equipment)

        completed = sum(1 for a in report.work_activities if a.status == WorkStatus.COMPLETED)
        in_progress = sum(1 for a in report.work_activities if a.status == WorkStatus.IN_PROGRESS)
        delayed = sum(1 for a in report.work_activities if a.status == WorkStatus.DELAYED)

        return {
            'total_workers': total_workers,
            'total_manhours': round(total_manhours, 1),
            'total_overtime': round(total_overtime, 1),
            'equipment_hours': round(equipment_hours, 1),
            'activities_completed': completed,
            'activities_in_progress': in_progress,
            'activities_delayed': delayed,
            'safety_incidents': report.safety_incidents,
            'deliveries_count': len(report.deliveries)
        }

    def export_to_excel(self, report: DailyReport, output_path: str) -> str:
        """Export report to Excel."""

        with pd.ExcelWriter(output_path, engine='openpyxl') as writer:
            # Header
            header_df = pd.DataFrame([{
                'Project': report.project_name,
                'Project #': report.project_number,
                'Date': report.report_date,
                'Weather': report.weather.value,
                'High Temp': report.temperature_high,
                'Low Temp': report.temperature_low,
                'Prepared By': report.prepared_by
            }])
            header_df.to_excel(writer, sheet_name='Summary', index=False)

            # Work Activities
            if report.work_activities:
                activities_df = pd.DataFrame([
                    {
                        'Activity ID': a.activity_id,
                        'Description': a.description,
                        'Location': a.location,
                        'Planned': a.planned_qty,
                        'Actual': a.actual_qty,
                        'Unit': a.unit,
                        'Status': a.status.value,
                        'Crew': a.crew_size,
                        'Hours': a.hours_worked,
                        'Notes': a.notes
                    }
                    for a in report.work_activities
                ])
                activities_df.to_excel(writer, sheet_name='Work Activities', index=False)

            # Labor
            if report.labor:
                labor_df = pd.DataFrame([
                    {
                        'Trade': l.trade,
                        'Company': l.company,
                        'Workers': l.workers,
                        'Hours': l.hours,
                        'Overtime': l.overtime_hours,
                        'Total Hours': l.workers * (l.hours + l.overtime_hours)
                    }
                    for l in report.labor
                ])
                labor_df.to_excel(writer, sheet_name='Labor', index=False)

            # Equipment
            if report.equipment:
                equip_df = pd.DataFrame([
                    {
                        'Type': e.equipment_type,
                        'ID': e.equipment_id,
                        'Hours': e.hours_used,
                        'Status': e.status,
                        'Operator': e.operator
                    }
                    for e in report.equipment
                ])
                equip_df.to_excel(writer, sheet_name='Equipment', index=False)

        return output_path

    def generate_text_report(self, report: DailyReport) -> str:
        """Generate text version of report."""

        summary = self.calculate_summary(report)

        lines = [
            f"DAILY PROGRESS REPORT",
            f"=" * 50,
            f"Project: {report.project_name}",
            f"Project #: {report.project_number}",
            f"Date: {report.report_date}",
            f"Prepared by: {report.prepared_by}",
            f"",
            f"WEATHER CONDITIONS",
            f"-" * 30,
            f"Conditions: {report.weather.value}",
            f"Temperature: {report.temperature_low}°C - {report.temperature_high}°C",
            f"",
            f"SUMMARY",
            f"-" * 30,
            f"Total Workers: {summary['total_workers']}",
            f"Total Man-hours: {summary['total_manhours']}",
            f"Equipment Hours: {summary['equipment_hours']}",
            f"Activities Completed: {summary['activities_completed']}",
            f"Activities In Progress: {summary['activities_in_progress']}",
            f"Activities Delayed: {summary['activities_delayed']}",
            f"Safety Incidents: {summary['safety_incidents']}",
        ]

        if report.delays:
            lines.extend([f"", f"DELAYS", f"-" * 30])
            for delay in report.delays:
                lines.append(f"• {delay}")

        return "\n".join(lines)
```

## Quick Start

```python
from datetime import date

# Initialize reporter
reporter = DailyProgressReporter("Office Tower A", "PRJ-2024-001")

# Create report
report = reporter.create_report(
    report_date=date.today(),
    weather=WeatherCondition.CLEAR,
    temp_high=28,
    temp_low=18,
    prepared_by="John Smith"
)

# Add activities
reporter.add_work_activity(
    report,
    activity_id="A-101",
    description="Pour concrete slab Level 3",
    location="Level 3, Zone A",
    planned_qty=150,
    actual_qty=150,
    unit="m3",
    crew_size=8,
    hours_worked=10
)

# Add labor
reporter.add_labor(report, "Concrete", "ABC Concrete Co", 8, 10, 2)

# Export
reporter.export_to_excel(report, "daily_report.xlsx")
```

## Common Use Cases

### 1. Generate Text Summary
```python
text = reporter.generate_text_report(report)
print(text)
```

### 2. Track Delays
```python
report.delays.append("Weather delay - rain from 14:00-16:00")
report.delays.append("Material delivery late by 2 hours")
```

### 3. Calculate Metrics
```python
summary = reporter.calculate_summary(report)
print(f"Productivity: {summary['total_manhours']} man-hours")
```

## Resources
- **Jens Book**: Chapter 4.1 - Site Data Collection


---


# Productivity Analyzer

## Business Case

### Problem Statement
Understanding productivity requires:
- Tracking actual output rates
- Comparing to planned rates
- Identifying problem areas
- Forecasting project completion

### Solution
Analyze labor productivity data to identify trends, compare to benchmarks, and provide actionable insights.

## Technical Implementation

```python
import pandas as pd
import numpy as np
from typing import Dict, Any, List, Optional
from dataclasses import dataclass
from datetime import date, timedelta
from enum import Enum


class ProductivityStatus(Enum):
    EXCELLENT = "excellent"    # >110% of planned
    ON_TARGET = "on_target"    # 90-110%
    BELOW = "below"            # 70-90%
    CRITICAL = "critical"      # <70%


@dataclass
class ProductivityRecord:
    date: date
    activity_code: str
    description: str
    planned_output: float
    actual_output: float
    unit: str
    manhours: float
    crew_size: int
    conditions: str  # weather, access issues


@dataclass
class ProductivityAnalysis:
    activity_code: str
    description: str
    total_planned: float
    total_actual: float
    total_manhours: float
    planned_rate: float  # unit per manhour
    actual_rate: float
    efficiency: float  # percentage
    status: ProductivityStatus
    trend: str  # improving, declining, stable


class ProductivityAnalyzer:
    """Analyze construction productivity data."""

    # Industry benchmark rates (unit per manhour)
    BENCHMARKS = {
        'concrete_pour': 0.5,      # m3/MH
        'rebar_install': 15,       # kg/MH
        'formwork': 0.8,           # m2/MH
        'brick_laying': 35,        # bricks/MH
        'drywall': 1.5,            # m2/MH
        'painting': 3.0,           # m2/MH
        'conduit': 8,              # m/MH
        'pipe': 3,                 # m/MH
        'excavation': 2.5,         # m3/MH
        'backfill': 3.0,           # m3/MH
    }

    def __init__(self):
        self.records: List[ProductivityRecord] = []

    def add_record(self,
                   date: date,
                   activity_code: str,
                   description: str,
                   planned_output: float,
                   actual_output: float,
                   unit: str,
                   manhours: float,
                   crew_size: int,
                   conditions: str = "normal"):
        """Add productivity record."""

        self.records.append(ProductivityRecord(
            date=date,
            activity_code=activity_code,
            description=description,
            planned_output=planned_output,
            actual_output=actual_output,
            unit=unit,
            manhours=manhours,
            crew_size=crew_size,
            conditions=conditions
        ))

    def import_from_dataframe(self, df: pd.DataFrame):
        """Import records from DataFrame."""
        for _, row in df.iterrows():
            self.add_record(
                date=pd.to_datetime(row['date']).date(),
                activity_code=row['activity_code'],
                description=row.get('description', ''),
                planned_output=float(row['planned_output']),
                actual_output=float(row['actual_output']),
                unit=row.get('unit', 'unit'),
                manhours=float(row['manhours']),
                crew_size=int(row.get('crew_size', 1)),
                conditions=row.get('conditions', 'normal')
            )

    def _get_status(self, efficiency: float) -> ProductivityStatus:
        """Determine productivity status."""
        if efficiency >= 110:
            return ProductivityStatus.EXCELLENT
        elif efficiency >= 90:
            return ProductivityStatus.ON_TARGET
        elif efficiency >= 70:
            return ProductivityStatus.BELOW
        else:
            return ProductivityStatus.CRITICAL

    def _calculate_trend(self, records: List[ProductivityRecord]) -> str:
        """Calculate productivity trend."""
        if len(records) < 3:
            return "insufficient_data"

        # Sort by date
        sorted_records = sorted(records, key=lambda x: x.date)

        # Calculate efficiency for first and last third
        n = len(sorted_records)
        third = n // 3

        early_efficiency = []
        late_efficiency = []

        for i, r in enumerate(sorted_records):
            if r.manhours > 0:
                eff = (r.actual_output / r.planned_output * 100) if r.planned_output > 0 else 0
                if i < third:
                    early_efficiency.append(eff)
                elif i >= n - third:
                    late_efficiency.append(eff)

        if not early_efficiency or not late_efficiency:
            return "stable"

        early_avg = np.mean(early_efficiency)
        late_avg = np.mean(late_efficiency)

        if late_avg > early_avg * 1.05:
            return "improving"
        elif late_avg < early_avg * 0.95:
            return "declining"
        else:
            return "stable"

    def analyze_activity(self, activity_code: str) -> Optional[ProductivityAnalysis]:
        """Analyze productivity for specific activity."""

        activity_records = [r for r in self.records if r.activity_code == activity_code]

        if not activity_records:
            return None

        total_planned = sum(r.planned_output for r in activity_records)
        total_actual = sum(r.actual_output for r in activity_records)
        total_manhours = sum(r.manhours for r in activity_records)

        planned_rate = total_planned / total_manhours if total_manhours > 0 else 0
        actual_rate = total_actual / total_manhours if total_manhours > 0 else 0
        efficiency = (total_actual / total_planned * 100) if total_planned > 0 else 0

        return ProductivityAnalysis(
            activity_code=activity_code,
            description=activity_records[0].description,
            total_planned=round(total_planned, 2),
            total_actual=round(total_actual, 2),
            total_manhours=round(total_manhours, 1),
            planned_rate=round(planned_rate, 3),
            actual_rate=round(actual_rate, 3),
            efficiency=round(efficiency, 1),
            status=self._get_status(efficiency),
            trend=self._calculate_trend(activity_records)
        )

    def analyze_all_activities(self) -> List[ProductivityAnalysis]:
        """Analyze all activities."""
        activities = set(r.activity_code for r in self.records)
        return [self.analyze_activity(code) for code in activities if self.analyze_activity(code)]

    def compare_to_benchmark(self, activity_code: str) -> Dict[str, Any]:
        """Compare activity to industry benchmark."""

        analysis = self.analyze_activity(activity_code)
        if not analysis:
            return {}

        # Find matching benchmark
        benchmark = None
        for key, value in self.BENCHMARKS.items():
            if key in activity_code.lower():
                benchmark = value
                break

        if benchmark is None:
            return {
                'activity': activity_code,
                'actual_rate': analysis.actual_rate,
                'benchmark': 'Not available',
                'vs_benchmark': 'N/A'
            }

        vs_benchmark = (analysis.actual_rate / benchmark * 100) if benchmark > 0 else 0

        return {
            'activity': activity_code,
            'actual_rate': analysis.actual_rate,
            'benchmark_rate': benchmark,
            'vs_benchmark_pct': round(vs_benchmark, 1),
            'recommendation': 'Above benchmark' if vs_benchmark >= 100 else 'Below benchmark - investigate'
        }

    def identify_problem_areas(self) -> List[Dict[str, Any]]:
        """Identify activities with productivity issues."""

        problems = []

        for analysis in self.analyze_all_activities():
            if analysis.status in [ProductivityStatus.BELOW, ProductivityStatus.CRITICAL]:
                problems.append({
                    'activity': analysis.activity_code,
                    'efficiency': analysis.efficiency,
                    'status': analysis.status.value,
                    'trend': analysis.trend,
                    'manhours_impacted': analysis.total_manhours,
                    'priority': 'HIGH' if analysis.status == ProductivityStatus.CRITICAL else 'MEDIUM'
                })

        return sorted(problems, key=lambda x: x['efficiency'])

    def forecast_completion(self,
                            activity_code: str,
                            remaining_quantity: float) -> Dict[str, Any]:
        """Forecast completion based on current productivity."""

        analysis = self.analyze_activity(activity_code)
        if not analysis or analysis.actual_rate == 0:
            return {}

        # Manhours needed at current rate
        manhours_needed = remaining_quantity / analysis.actual_rate

        # Average daily manhours
        activity_records = [r for r in self.records if r.activity_code == activity_code]
        avg_daily_mh = np.mean([r.manhours for r in activity_records]) if activity_records else 8

        days_needed = manhours_needed / avg_daily_mh if avg_daily_mh > 0 else 0

        return {
            'activity': activity_code,
            'remaining_qty': remaining_quantity,
            'current_rate': analysis.actual_rate,
            'manhours_needed': round(manhours_needed, 1),
            'days_needed': round(days_needed, 1),
            'estimated_completion': date.today() + timedelta(days=int(days_needed))
        }

    def export_analysis(self, output_path: str) -> str:
        """Export analysis to Excel."""

        with pd.ExcelWriter(output_path, engine='openpyxl') as writer:
            # Summary
            analyses = self.analyze_all_activities()
            summary_df = pd.DataFrame([
                {
                    'Activity': a.activity_code,
                    'Description': a.description,
                    'Planned': a.total_planned,
                    'Actual': a.total_actual,
                    'Manhours': a.total_manhours,
                    'Efficiency %': a.efficiency,
                    'Status': a.status.value,
                    'Trend': a.trend
                }
                for a in analyses
            ])
            summary_df.to_excel(writer, sheet_name='Summary', index=False)

            # Problems
            problems = self.identify_problem_areas()
            if problems:
                problems_df = pd.DataFrame(problems)
                problems_df.to_excel(writer, sheet_name='Problem Areas', index=False)

            # Raw data
            records_df = pd.DataFrame([
                {
                    'Date': r.date,
                    'Activity': r.activity_code,
                    'Planned': r.planned_output,
                    'Actual': r.actual_output,
                    'Unit': r.unit,
                    'Manhours': r.manhours,
                    'Crew': r.crew_size,
                    'Conditions': r.conditions
                }
                for r in self.records
            ])
            records_df.to_excel(writer, sheet_name='Raw Data', index=False)

        return output_path
```

## Quick Start

```python
from datetime import date, timedelta

# Initialize analyzer
analyzer = ProductivityAnalyzer()

# Add records
for i in range(10):
    analyzer.add_record(
        date=date.today() - timedelta(days=i),
        activity_code="concrete_pour",
        description="Slab pour Level 3",
        planned_output=20,
        actual_output=18 + (i * 0.3),  # improving
        unit="m3",
        manhours=40,
        crew_size=5
    )

# Analyze
analysis = analyzer.analyze_activity("concrete_pour")
print(f"Efficiency: {analysis.efficiency}%")
print(f"Status: {analysis.status.value}")
print(f"Trend: {analysis.trend}")
```

## Common Use Cases

### 1. Identify Problems
```python
problems = analyzer.identify_problem_areas()
for p in problems:
    print(f"{p['activity']}: {p['efficiency']}% - {p['priority']}")
```

### 2. Forecast Completion
```python
forecast = analyzer.forecast_completion("concrete_pour", remaining_quantity=500)
print(f"Days needed: {forecast['days_needed']}")
print(f"Completion: {forecast['estimated_completion']}")
```

### 3. Compare to Benchmarks
```python
comparison = analyzer.compare_to_benchmark("concrete_pour")
print(f"vs Benchmark: {comparison['vs_benchmark_pct']}%")
```

## Resources
- **Jens Book**: Chapter 4.1 - Productivity Management


---


# Project KPI Dashboard

## Business Case

### Problem Statement
Project stakeholders struggle with:
- Scattered data across multiple systems
- Delayed reporting on project health
- No real-time visibility into KPIs
- Inconsistent metric definitions

### Solution
Centralized KPI dashboard that aggregates data from multiple sources and presents key metrics with drill-down capabilities.

### Business Value
- **Real-time visibility** - Live project health status
- **Data-driven decisions** - Actionable insights
- **Stakeholder alignment** - Single source of truth
- **Early warning** - Proactive issue detection

## Technical Implementation

```python
import pandas as pd
from datetime import datetime, date, timedelta
from typing import Dict, Any, List, Optional
from dataclasses import dataclass, field
from enum import Enum


class KPIStatus(Enum):
    """KPI health status."""
    ON_TRACK = "on_track"
    AT_RISK = "at_risk"
    CRITICAL = "critical"
    UNKNOWN = "unknown"


class KPICategory(Enum):
    """KPI categories."""
    SCHEDULE = "schedule"
    COST = "cost"
    QUALITY = "quality"
    SAFETY = "safety"
    PRODUCTIVITY = "productivity"
    SUSTAINABILITY = "sustainability"


@dataclass
class KPIMetric:
    """Single KPI metric."""
    name: str
    category: KPICategory
    current_value: float
    target_value: float
    unit: str
    status: KPIStatus
    trend: str  # up, down, stable
    last_updated: datetime
    description: str = ""

    @property
    def variance(self) -> float:
        """Calculate variance from target."""
        if self.target_value == 0:
            return 0
        return ((self.current_value - self.target_value) / self.target_value) * 100

    @property
    def achievement(self) -> float:
        """Calculate achievement percentage."""
        if self.target_value == 0:
            return 0
        return (self.current_value / self.target_value) * 100


@dataclass
class DashboardConfig:
    """Dashboard configuration."""
    project_name: str
    project_code: str
    start_date: date
    end_date: date
    budget: float
    currency: str = "USD"
    refresh_interval_minutes: int = 15


class ProjectKPIDashboard:
    """Construction project KPI dashboard."""

    # Standard thresholds for RAG status
    THRESHOLDS = {
        'schedule': {'green': 0.95, 'amber': 0.85},
        'cost': {'green': 1.05, 'amber': 1.15},
        'quality': {'green': 0.98, 'amber': 0.95},
        'safety': {'green': 0, 'amber': 1}  # incident count
    }

    def __init__(self, config: DashboardConfig):
        self.config = config
        self.metrics: Dict[str, KPIMetric] = {}
        self.history: List[Dict[str, Any]] = []

    def add_metric(self, metric: KPIMetric):
        """Add or update a KPI metric."""
        self.metrics[metric.name] = metric
        self._record_history(metric)

    def _record_history(self, metric: KPIMetric):
        """Record metric history for trending."""
        self.history.append({
            'name': metric.name,
            'value': metric.current_value,
            'timestamp': metric.last_updated,
            'status': metric.status.value
        })

    def calculate_schedule_kpis(self,
                                 planned_activities: int,
                                 completed_activities: int,
                                 planned_duration_days: int,
                                 actual_duration_days: int) -> List[KPIMetric]:
        """Calculate schedule-related KPIs."""

        # Schedule Performance Index (SPI)
        spi = completed_activities / planned_activities if planned_activities > 0 else 0
        spi_status = self._get_status(spi, 'schedule')

        # Schedule Variance
        sv = completed_activities - planned_activities

        # Percent Complete
        pct_complete = (completed_activities / planned_activities * 100) if planned_activities > 0 else 0

        metrics = [
            KPIMetric(
                name="Schedule Performance Index",
                category=KPICategory.SCHEDULE,
                current_value=round(spi, 2),
                target_value=1.0,
                unit="ratio",
                status=spi_status,
                trend=self._calculate_trend("Schedule Performance Index"),
                last_updated=datetime.now(),
                description="SPI = Earned Value / Planned Value"
            ),
            KPIMetric(
                name="Percent Complete",
                category=KPICategory.SCHEDULE,
                current_value=round(pct_complete, 1),
                target_value=100,
                unit="%",
                status=spi_status,
                trend=self._calculate_trend("Percent Complete"),
                last_updated=datetime.now()
            ),
            KPIMetric(
                name="Schedule Variance",
                category=KPICategory.SCHEDULE,
                current_value=sv,
                target_value=0,
                unit="activities",
                status=spi_status,
                trend=self._calculate_trend("Schedule Variance"),
                last_updated=datetime.now()
            )
        ]

        for m in metrics:
            self.add_metric(m)

        return metrics

    def calculate_cost_kpis(self,
                            budgeted_cost: float,
                            actual_cost: float,
                            earned_value: float) -> List[KPIMetric]:
        """Calculate cost-related KPIs."""

        # Cost Performance Index (CPI)
        cpi = earned_value / actual_cost if actual_cost > 0 else 0
        cpi_status = self._get_status(cpi, 'cost', inverse=True)

        # Cost Variance
        cv = earned_value - actual_cost

        # Budget utilization
        budget_used = (actual_cost / budgeted_cost * 100) if budgeted_cost > 0 else 0

        metrics = [
            KPIMetric(
                name="Cost Performance Index",
                category=KPICategory.COST,
                current_value=round(cpi, 2),
                target_value=1.0,
                unit="ratio",
                status=cpi_status,
                trend=self._calculate_trend("Cost Performance Index"),
                last_updated=datetime.now(),
                description="CPI = Earned Value / Actual Cost"
            ),
            KPIMetric(
                name="Cost Variance",
                category=KPICategory.COST,
                current_value=round(cv, 2),
                target_value=0,
                unit=self.config.currency,
                status=cpi_status,
                trend=self._calculate_trend("Cost Variance"),
                last_updated=datetime.now()
            ),
            KPIMetric(
                name="Budget Utilization",
                category=KPICategory.COST,
                current_value=round(budget_used, 1),
                target_value=100,
                unit="%",
                status=cpi_status,
                trend=self._calculate_trend("Budget Utilization"),
                last_updated=datetime.now()
            )
        ]

        for m in metrics:
            self.add_metric(m)

        return metrics

    def calculate_quality_kpis(self,
                               total_inspections: int,
                               passed_inspections: int,
                               rework_items: int,
                               total_items: int) -> List[KPIMetric]:
        """Calculate quality-related KPIs."""

        # First Pass Yield
        fpy = passed_inspections / total_inspections if total_inspections > 0 else 0
        fpy_status = self._get_status(fpy, 'quality')

        # Rework Rate
        rework_rate = rework_items / total_items * 100 if total_items > 0 else 0

        metrics = [
            KPIMetric(
                name="First Pass Yield",
                category=KPICategory.QUALITY,
                current_value=round(fpy * 100, 1),
                target_value=98,
                unit="%",
                status=fpy_status,
                trend=self._calculate_trend("First Pass Yield"),
                last_updated=datetime.now()
            ),
            KPIMetric(
                name="Rework Rate",
                category=KPICategory.QUALITY,
                current_value=round(rework_rate, 1),
                target_value=2,
                unit="%",
                status=fpy_status,
                trend=self._calculate_trend("Rework Rate"),
                last_updated=datetime.now()
            )
        ]

        for m in metrics:
            self.add_metric(m)

        return metrics

    def calculate_safety_kpis(self,
                              incidents: int,
                              near_misses: int,
                              worked_hours: float,
                              safety_observations: int) -> List[KPIMetric]:
        """Calculate safety-related KPIs."""

        # TRIR (Total Recordable Incident Rate)
        trir = (incidents * 200000) / worked_hours if worked_hours > 0 else 0
        trir_status = KPIStatus.ON_TRACK if incidents == 0 else (
            KPIStatus.AT_RISK if incidents <= 2 else KPIStatus.CRITICAL
        )

        # LTIR (Lost Time Incident Rate)
        ltir = (incidents * 1000000) / worked_hours if worked_hours > 0 else 0

        metrics = [
            KPIMetric(
                name="TRIR",
                category=KPICategory.SAFETY,
                current_value=round(trir, 2),
                target_value=0,
                unit="per 200k hrs",
                status=trir_status,
                trend=self._calculate_trend("TRIR"),
                last_updated=datetime.now(),
                description="Total Recordable Incident Rate"
            ),
            KPIMetric(
                name="Safety Observations",
                category=KPICategory.SAFETY,
                current_value=safety_observations,
                target_value=50,
                unit="count",
                status=KPIStatus.ON_TRACK if safety_observations >= 50 else KPIStatus.AT_RISK,
                trend=self._calculate_trend("Safety Observations"),
                last_updated=datetime.now()
            ),
            KPIMetric(
                name="Near Miss Reports",
                category=KPICategory.SAFETY,
                current_value=near_misses,
                target_value=10,
                unit="count",
                status=KPIStatus.ON_TRACK,
                trend=self._calculate_trend("Near Miss Reports"),
                last_updated=datetime.now()
            )
        ]

        for m in metrics:
            self.add_metric(m)

        return metrics

    def _get_status(self, value: float, category: str, inverse: bool = False) -> KPIStatus:
        """Determine RAG status based on thresholds."""
        thresholds = self.THRESHOLDS.get(category, {'green': 0.95, 'amber': 0.85})

        if inverse:
            if value >= thresholds['green']:
                return KPIStatus.ON_TRACK
            elif value >= thresholds['amber']:
                return KPIStatus.AT_RISK
            else:
                return KPIStatus.CRITICAL
        else:
            if value >= thresholds['green']:
                return KPIStatus.ON_TRACK
            elif value >= thresholds['amber']:
                return KPIStatus.AT_RISK
            else:
                return KPIStatus.CRITICAL

    def _calculate_trend(self, metric_name: str) -> str:
        """Calculate trend based on historical data."""
        history = [h for h in self.history if h['name'] == metric_name]
        if len(history) < 2:
            return "stable"

        recent = history[-1]['value']
        previous = history[-2]['value']

        if recent > previous * 1.02:
            return "up"
        elif recent < previous * 0.98:
            return "down"
        return "stable"

    def get_dashboard_summary(self) -> Dict[str, Any]:
        """Generate dashboard summary."""
        by_category = {}
        for metric in self.metrics.values():
            cat = metric.category.value
            if cat not in by_category:
                by_category[cat] = []
            by_category[cat].append({
                'name': metric.name,
                'value': metric.current_value,
                'target': metric.target_value,
                'unit': metric.unit,
                'status': metric.status.value,
                'trend': metric.trend,
                'variance': round(metric.variance, 1)
            })

        # Overall health
        statuses = [m.status for m in self.metrics.values()]
        critical_count = sum(1 for s in statuses if s == KPIStatus.CRITICAL)
        at_risk_count = sum(1 for s in statuses if s == KPIStatus.AT_RISK)

        if critical_count > 0:
            overall = "CRITICAL"
        elif at_risk_count > 2:
            overall = "AT_RISK"
        else:
            overall = "ON_TRACK"

        return {
            'project': self.config.project_name,
            'project_code': self.config.project_code,
            'generated_at': datetime.now().isoformat(),
            'overall_health': overall,
            'metrics_count': len(self.metrics),
            'critical_count': critical_count,
            'at_risk_count': at_risk_count,
            'kpis_by_category': by_category
        }

    def export_to_dataframe(self) -> pd.DataFrame:
        """Export all KPIs to DataFrame."""
        data = []
        for metric in self.metrics.values():
            data.append({
                'KPI': metric.name,
                'Category': metric.category.value,
                'Current': metric.current_value,
                'Target': metric.target_value,
                'Unit': metric.unit,
                'Variance %': round(metric.variance, 1),
                'Status': metric.status.value,
                'Trend': metric.trend,
                'Last Updated': metric.last_updated
            })
        return pd.DataFrame(data)
```

## Quick Start

```python
from datetime import date

# Configure dashboard
config = DashboardConfig(
    project_name="Office Tower Construction",
    project_code="PRJ-2024-001",
    start_date=date(2024, 1, 1),
    end_date=date(2025, 12, 31),
    budget=50000000,
    currency="USD"
)

# Initialize dashboard
dashboard = ProjectKPIDashboard(config)

# Calculate schedule KPIs
dashboard.calculate_schedule_kpis(
    planned_activities=100,
    completed_activities=85,
    planned_duration_days=180,
    actual_duration_days=195
)

# Calculate cost KPIs
dashboard.calculate_cost_kpis(
    budgeted_cost=25000000,
    actual_cost=24500000,
    earned_value=24000000
)

# Get summary
summary = dashboard.get_dashboard_summary()
print(f"Overall Health: {summary['overall_health']}")
```

## Common Use Cases

### 1. Weekly Executive Report
```python
df = dashboard.export_to_dataframe()
critical = df[df['Status'] == 'critical']
print(f"Critical KPIs requiring attention: {len(critical)}")
```

### 2. Trend Analysis
```python
# Get historical data for a metric
spi_history = [h for h in dashboard.history if h['name'] == 'Schedule Performance Index']
```

### 3. Multi-Project Dashboard
```python
projects = []
for project_config in project_configs:
    dash = ProjectKPIDashboard(project_config)
    # ... calculate KPIs
    projects.append(dash.get_dashboard_summary())
```

## Resources
- **Jens Book**: Chapter 4.1 - Construction Analytics
- **Reference**: PMI Earned Value Management


---

