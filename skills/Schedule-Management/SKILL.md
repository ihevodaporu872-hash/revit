# Schedule-Management Skills

Consolidated skill reference for Schedule-Management operations.

---

# BIM to Schedule 4D Simulation

## Technical Implementation

```python
import pandas as pd
from datetime import date, datetime
from typing import Dict, Any, List
from dataclasses import dataclass, field
from enum import Enum


class SimulationStatus(Enum):
    SETUP = "setup"
    READY = "ready"
    RUNNING = "running"
    COMPLETE = "complete"


@dataclass
class TimeSlice:
    slice_date: date
    visible_elements: List[str]
    active_activities: List[str]
    completed_activities: List[str]


@dataclass
class Simulation4D:
    simulation_id: str
    name: str
    start_date: date
    end_date: date
    interval_days: int
    status: SimulationStatus
    time_slices: List[TimeSlice] = field(default_factory=list)


class BIMSchedule4DSimulation:
    def __init__(self, project_name: str):
        self.project_name = project_name
        self.elements: Dict[str, Dict[str, Any]] = {}
        self.activities: Dict[str, Dict[str, Any]] = {}
        self.links: Dict[str, List[str]] = {}  # activity_id: [element_ids]
        self.simulations: Dict[str, Simulation4D] = {}

    def add_element(self, element_id: str, name: str, category: str, level: str):
        self.elements[element_id] = {
            'id': element_id, 'name': name, 'category': category, 'level': level
        }

    def add_activity(self, activity_id: str, name: str, start: date, end: date):
        self.activities[activity_id] = {
            'id': activity_id, 'name': name, 'start': start, 'end': end
        }

    def link_elements(self, activity_id: str, element_ids: List[str]):
        self.links[activity_id] = element_ids

    def create_simulation(self, name: str, start: date, end: date,
                         interval_days: int = 7) -> Simulation4D:
        sim_id = f"SIM-{len(self.simulations) + 1:03d}"
        simulation = Simulation4D(
            simulation_id=sim_id,
            name=name,
            start_date=start,
            end_date=end,
            interval_days=interval_days,
            status=SimulationStatus.SETUP
        )
        self.simulations[sim_id] = simulation
        return simulation

    def generate_time_slices(self, sim_id: str):
        if sim_id not in self.simulations:
            return

        sim = self.simulations[sim_id]
        sim.time_slices = []
        current = sim.start_date

        while current <= sim.end_date:
            visible = []
            active = []
            completed = []

            for act_id, act in self.activities.items():
                if act['end'] < current:
                    completed.append(act_id)
                    if act_id in self.links:
                        visible.extend(self.links[act_id])
                elif act['start'] <= current <= act['end']:
                    active.append(act_id)
                    if act_id in self.links:
                        visible.extend(self.links[act_id])

            slice = TimeSlice(
                slice_date=current,
                visible_elements=list(set(visible)),
                active_activities=active,
                completed_activities=completed
            )
            sim.time_slices.append(slice)

            from datetime import timedelta
            current += timedelta(days=sim.interval_days)

        sim.status = SimulationStatus.READY

    def get_slice_at_date(self, sim_id: str, target_date: date) -> TimeSlice:
        if sim_id not in self.simulations:
            return None
        sim = self.simulations[sim_id]
        for slice in sim.time_slices:
            if slice.slice_date == target_date:
                return slice
        return None

    def export_simulation(self, sim_id: str, output_path: str):
        if sim_id not in self.simulations:
            return
        sim = self.simulations[sim_id]
        data = [{
            'Date': s.slice_date,
            'Visible Elements': len(s.visible_elements),
            'Active Activities': len(s.active_activities),
            'Completed': len(s.completed_activities)
        } for s in sim.time_slices]
        pd.DataFrame(data).to_excel(output_path, index=False)
```

## Quick Start

```python
sim = BIMSchedule4DSimulation("Office Tower")

sim.add_element("E001", "Footing", "Foundation", "B1")
sim.add_activity("A100", "Foundation", date(2024, 1, 1), date(2024, 2, 28))
sim.link_elements("A100", ["E001"])

simulation = sim.create_simulation("Construction Sequence", date(2024, 1, 1), date(2024, 12, 31))
sim.generate_time_slices(simulation.simulation_id)
```

## Resources
- **Jens Book**: Chapter 3.3 - 4D BIM


---


# Critical Path Analyzer

## Business Case

### Problem Statement
Schedule management requires understanding:
- Which activities are critical?
- How much float exists?
- What delays impact completion?
- Where to focus resources?

### Solution
Analyze schedule network to identify critical path, calculate float, and provide actionable schedule insights.

## Technical Implementation

```python
import pandas as pd
import numpy as np
from typing import Dict, Any, List, Optional, Set
from dataclasses import dataclass, field
from datetime import date, timedelta
from enum import Enum
from collections import defaultdict


class ActivityStatus(Enum):
    NOT_STARTED = "not_started"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    DELAYED = "delayed"


@dataclass
class Activity:
    activity_id: str
    name: str
    duration: int  # days
    predecessors: List[str]
    early_start: int = 0
    early_finish: int = 0
    late_start: int = 0
    late_finish: int = 0
    total_float: int = 0
    free_float: int = 0
    is_critical: bool = False
    status: ActivityStatus = ActivityStatus.NOT_STARTED
    percent_complete: float = 0
    actual_start: Optional[date] = None
    actual_finish: Optional[date] = None


@dataclass
class CriticalPathResult:
    critical_path: List[str]
    project_duration: int
    activities: Dict[str, Activity]
    near_critical: List[str]  # Float < 5 days
    total_float_days: int


class CriticalPathAnalyzer:
    """Analyze project critical path."""

    NEAR_CRITICAL_THRESHOLD = 5  # days

    def __init__(self, project_start: date):
        self.project_start = project_start
        self.activities: Dict[str, Activity] = {}

    def add_activity(self,
                     activity_id: str,
                     name: str,
                     duration: int,
                     predecessors: List[str] = None):
        """Add activity to network."""

        self.activities[activity_id] = Activity(
            activity_id=activity_id,
            name=name,
            duration=duration,
            predecessors=predecessors or []
        )

    def import_from_dataframe(self, df: pd.DataFrame):
        """Import activities from DataFrame."""
        for _, row in df.iterrows():
            preds = row.get('predecessors', '')
            if pd.isna(preds):
                pred_list = []
            else:
                pred_list = [p.strip() for p in str(preds).split(',') if p.strip()]

            self.add_activity(
                activity_id=str(row['activity_id']),
                name=row['name'],
                duration=int(row['duration']),
                predecessors=pred_list
            )

    def _forward_pass(self):
        """Calculate early start and early finish (forward pass)."""

        # Topological sort
        sorted_activities = self._topological_sort()

        for activity_id in sorted_activities:
            activity = self.activities[activity_id]

            # Early start = max(early finish of all predecessors)
            if not activity.predecessors:
                activity.early_start = 0
            else:
                activity.early_start = max(
                    self.activities[pred].early_finish
                    for pred in activity.predecessors
                    if pred in self.activities
                )

            activity.early_finish = activity.early_start + activity.duration

    def _backward_pass(self):
        """Calculate late start and late finish (backward pass)."""

        # Find project duration
        project_duration = max(a.early_finish for a in self.activities.values())

        # Build successors map
        successors = defaultdict(list)
        for activity_id, activity in self.activities.items():
            for pred in activity.predecessors:
                if pred in self.activities:
                    successors[pred].append(activity_id)

        # Reverse topological order
        sorted_activities = self._topological_sort()[::-1]

        for activity_id in sorted_activities:
            activity = self.activities[activity_id]

            # Late finish = min(late start of all successors)
            if activity_id not in successors or not successors[activity_id]:
                activity.late_finish = project_duration
            else:
                activity.late_finish = min(
                    self.activities[succ].late_start
                    for succ in successors[activity_id]
                )

            activity.late_start = activity.late_finish - activity.duration

            # Calculate floats
            activity.total_float = activity.late_start - activity.early_start
            activity.is_critical = activity.total_float == 0

    def _topological_sort(self) -> List[str]:
        """Topological sort of activities."""

        visited = set()
        result = []

        def visit(activity_id: str):
            if activity_id in visited:
                return
            visited.add(activity_id)

            activity = self.activities.get(activity_id)
            if activity:
                for pred in activity.predecessors:
                    if pred in self.activities:
                        visit(pred)
                result.append(activity_id)

        for activity_id in self.activities:
            visit(activity_id)

        return result

    def calculate_critical_path(self) -> CriticalPathResult:
        """Calculate critical path and all float values."""

        self._forward_pass()
        self._backward_pass()

        # Find critical path
        critical_activities = [
            a.activity_id for a in self.activities.values()
            if a.is_critical
        ]

        # Near-critical activities
        near_critical = [
            a.activity_id for a in self.activities.values()
            if 0 < a.total_float <= self.NEAR_CRITICAL_THRESHOLD
        ]

        project_duration = max(a.early_finish for a in self.activities.values())
        total_float = sum(a.total_float for a in self.activities.values())

        return CriticalPathResult(
            critical_path=critical_activities,
            project_duration=project_duration,
            activities=self.activities,
            near_critical=near_critical,
            total_float_days=total_float
        )

    def get_schedule_dates(self) -> pd.DataFrame:
        """Get schedule with dates."""

        data = []
        for activity in self.activities.values():
            early_start_date = self.project_start + timedelta(days=activity.early_start)
            early_finish_date = self.project_start + timedelta(days=activity.early_finish)
            late_start_date = self.project_start + timedelta(days=activity.late_start)
            late_finish_date = self.project_start + timedelta(days=activity.late_finish)

            data.append({
                'Activity ID': activity.activity_id,
                'Name': activity.name,
                'Duration': activity.duration,
                'Early Start': early_start_date,
                'Early Finish': early_finish_date,
                'Late Start': late_start_date,
                'Late Finish': late_finish_date,
                'Total Float': activity.total_float,
                'Critical': 'Yes' if activity.is_critical else 'No'
            })

        return pd.DataFrame(data)

    def analyze_delay_impact(self,
                             activity_id: str,
                             delay_days: int) -> Dict[str, Any]:
        """Analyze impact of delay on project."""

        activity = self.activities.get(activity_id)
        if not activity:
            return {}

        absorbed_by_float = min(delay_days, activity.total_float)
        project_delay = max(0, delay_days - activity.total_float)

        # Find affected activities
        affected = []
        if project_delay > 0:
            # Activities that could be affected (successors)
            for a in self.activities.values():
                if activity_id in a.predecessors:
                    affected.append(a.activity_id)

        return {
            'activity': activity_id,
            'delay_days': delay_days,
            'available_float': activity.total_float,
            'absorbed_by_float': absorbed_by_float,
            'project_delay': project_delay,
            'affected_activities': affected,
            'is_critical_delay': project_delay > 0
        }

    def suggest_acceleration(self,
                             target_reduction: int) -> List[Dict[str, Any]]:
        """Suggest activities to accelerate to meet target."""

        result = self.calculate_critical_path()
        suggestions = []

        # Focus on critical activities
        for activity_id in result.critical_path:
            activity = self.activities[activity_id]

            # Assume can reduce by 20% max
            max_reduction = int(activity.duration * 0.2)

            if max_reduction > 0:
                suggestions.append({
                    'activity': activity_id,
                    'name': activity.name,
                    'current_duration': activity.duration,
                    'max_reduction': max_reduction,
                    'reason': 'Critical path activity'
                })

        # Sort by potential impact
        return sorted(suggestions, key=lambda x: x['max_reduction'], reverse=True)

    def export_analysis(self, output_path: str) -> str:
        """Export analysis to Excel."""

        result = self.calculate_critical_path()

        with pd.ExcelWriter(output_path, engine='openpyxl') as writer:
            # Summary
            summary_df = pd.DataFrame([{
                'Project Start': self.project_start,
                'Project Duration': result.project_duration,
                'Project Finish': self.project_start + timedelta(days=result.project_duration),
                'Critical Activities': len(result.critical_path),
                'Near-Critical Activities': len(result.near_critical),
                'Total Float (days)': result.total_float_days
            }])
            summary_df.to_excel(writer, sheet_name='Summary', index=False)

            # Schedule
            schedule_df = self.get_schedule_dates()
            schedule_df.to_excel(writer, sheet_name='Schedule', index=False)

            # Critical Path
            critical_df = pd.DataFrame([
                {
                    'Activity': a_id,
                    'Name': self.activities[a_id].name,
                    'Duration': self.activities[a_id].duration
                }
                for a_id in result.critical_path
            ])
            critical_df.to_excel(writer, sheet_name='Critical Path', index=False)

        return output_path
```

## Quick Start

```python
from datetime import date

# Initialize analyzer
analyzer = CriticalPathAnalyzer(project_start=date(2024, 6, 1))

# Add activities
analyzer.add_activity("A", "Site Preparation", 10, [])
analyzer.add_activity("B", "Foundation Excavation", 15, ["A"])
analyzer.add_activity("C", "Foundation Concrete", 20, ["B"])
analyzer.add_activity("D", "Structural Steel", 30, ["C"])
analyzer.add_activity("E", "MEP Rough-in", 25, ["C"])
analyzer.add_activity("F", "Exterior Walls", 20, ["D"])
analyzer.add_activity("G", "Interior Finish", 15, ["E", "F"])

# Calculate critical path
result = analyzer.calculate_critical_path()

print(f"Project Duration: {result.project_duration} days")
print(f"Critical Path: {result.critical_path}")
```

## Common Use Cases

### 1. Analyze Delay Impact
```python
impact = analyzer.analyze_delay_impact("C", delay_days=5)
print(f"Project Delay: {impact['project_delay']} days")
```

### 2. Get Schedule Dates
```python
schedule = analyzer.get_schedule_dates()
print(schedule[['Activity ID', 'Early Start', 'Late Finish', 'Total Float']])
```

### 3. Acceleration Suggestions
```python
suggestions = analyzer.suggest_acceleration(target_reduction=10)
for s in suggestions:
    print(f"{s['activity']}: can reduce {s['max_reduction']} days")
```

## Resources
- **Jens Book**: Chapter 4.2 - Schedule Analysis


---


# Schedule Delay Analyzer

## Technical Implementation

```python
import pandas as pd
from datetime import date, timedelta
from typing import Dict, Any, List, Optional
from dataclasses import dataclass, field
from enum import Enum


class DelayType(Enum):
    EXCUSABLE_COMPENSABLE = "excusable_compensable"
    EXCUSABLE_NON_COMPENSABLE = "excusable_non_compensable"
    NON_EXCUSABLE = "non_excusable"
    CONCURRENT = "concurrent"


class DelayCause(Enum):
    OWNER_CHANGE = "owner_change"
    DESIGN_ERROR = "design_error"
    WEATHER = "weather"
    DIFFERING_CONDITIONS = "differing_conditions"
    CONTRACTOR_ISSUE = "contractor_issue"
    MATERIAL_DELAY = "material_delay"
    LABOR_SHORTAGE = "labor_shortage"
    PERMIT_DELAY = "permit_delay"
    OTHER = "other"


@dataclass
class DelayEvent:
    delay_id: str
    activity_id: str
    activity_name: str
    delay_type: DelayType
    cause: DelayCause
    start_date: date
    end_date: date
    delay_days: int
    on_critical_path: bool
    description: str
    documentation: List[str] = field(default_factory=list)
    cost_impact: float = 0.0


@dataclass
class ScheduleBaseline:
    baseline_date: date
    planned_completion: date
    activities: Dict[str, Dict[str, date]]  # activity_id: {start, end}


class ScheduleDelayAnalyzer:
    def __init__(self, project_name: str, contract_completion: date):
        self.project_name = project_name
        self.contract_completion = contract_completion
        self.baselines: List[ScheduleBaseline] = []
        self.delays: Dict[str, DelayEvent] = {}
        self._counter = 0

    def add_baseline(self, baseline_date: date, planned_completion: date,
                    activities: Dict[str, Dict[str, date]]):
        baseline = ScheduleBaseline(baseline_date, planned_completion, activities)
        self.baselines.append(baseline)

    def record_delay(self, activity_id: str, activity_name: str,
                    delay_type: DelayType, cause: DelayCause,
                    start_date: date, end_date: date,
                    on_critical_path: bool, description: str,
                    cost_impact: float = 0) -> DelayEvent:
        self._counter += 1
        delay_id = f"DLY-{self._counter:04d}"

        delay = DelayEvent(
            delay_id=delay_id,
            activity_id=activity_id,
            activity_name=activity_name,
            delay_type=delay_type,
            cause=cause,
            start_date=start_date,
            end_date=end_date,
            delay_days=(end_date - start_date).days,
            on_critical_path=on_critical_path,
            description=description,
            cost_impact=cost_impact
        )
        self.delays[delay_id] = delay
        return delay

    def calculate_project_delay(self) -> int:
        """Calculate total critical path delay."""
        critical_delays = [d for d in self.delays.values() if d.on_critical_path]
        return sum(d.delay_days for d in critical_delays)

    def analyze_by_type(self) -> Dict[str, Dict[str, Any]]:
        analysis = {}
        for delay in self.delays.values():
            dtype = delay.delay_type.value
            if dtype not in analysis:
                analysis[dtype] = {'count': 0, 'days': 0, 'cost': 0}
            analysis[dtype]['count'] += 1
            analysis[dtype]['days'] += delay.delay_days
            analysis[dtype]['cost'] += delay.cost_impact
        return analysis

    def analyze_by_cause(self) -> Dict[str, int]:
        by_cause = {}
        for delay in self.delays.values():
            cause = delay.cause.value
            by_cause[cause] = by_cause.get(cause, 0) + delay.delay_days
        return by_cause

    def calculate_time_extension_claim(self) -> Dict[str, Any]:
        """Calculate basis for time extension claim."""
        excusable = [d for d in self.delays.values()
                    if d.delay_type in [DelayType.EXCUSABLE_COMPENSABLE,
                                        DelayType.EXCUSABLE_NON_COMPENSABLE]
                    and d.on_critical_path]

        compensable = [d for d in excusable
                      if d.delay_type == DelayType.EXCUSABLE_COMPENSABLE]

        return {
            'excusable_delays': len(excusable),
            'excusable_days': sum(d.delay_days for d in excusable),
            'compensable_delays': len(compensable),
            'compensable_days': sum(d.delay_days for d in compensable),
            'total_cost_impact': sum(d.cost_impact for d in compensable),
            'recommended_extension': sum(d.delay_days for d in excusable)
        }

    def get_summary(self) -> Dict[str, Any]:
        critical_delay = self.calculate_project_delay()
        projected_completion = self.contract_completion + timedelta(days=critical_delay)

        return {
            'project': self.project_name,
            'contract_completion': self.contract_completion,
            'projected_completion': projected_completion,
            'total_delays': len(self.delays),
            'critical_path_delays': sum(1 for d in self.delays.values() if d.on_critical_path),
            'total_delay_days': critical_delay,
            'by_type': self.analyze_by_type(),
            'by_cause': self.analyze_by_cause()
        }

    def export_analysis(self, output_path: str):
        data = [{
            'ID': d.delay_id,
            'Activity': d.activity_name,
            'Type': d.delay_type.value,
            'Cause': d.cause.value,
            'Start': d.start_date,
            'End': d.end_date,
            'Days': d.delay_days,
            'Critical': d.on_critical_path,
            'Cost Impact': d.cost_impact,
            'Description': d.description
        } for d in self.delays.values()]
        pd.DataFrame(data).to_excel(output_path, index=False)
```

## Quick Start

```python
analyzer = ScheduleDelayAnalyzer("Office Tower", date(2024, 12, 31))

delay = analyzer.record_delay(
    activity_id="A-300",
    activity_name="Foundation Work",
    delay_type=DelayType.EXCUSABLE_COMPENSABLE,
    cause=DelayCause.OWNER_CHANGE,
    start_date=date(2024, 3, 1),
    end_date=date(2024, 3, 15),
    on_critical_path=True,
    description="Owner requested additional scope",
    cost_impact=50000
)

summary = analyzer.get_summary()
print(f"Project delayed by {summary['total_delay_days']} days")

claim = analyzer.calculate_time_extension_claim()
print(f"Recommended extension: {claim['recommended_extension']} days")
```

## Resources
- **Jens Book**: Chapter 3.3 - Schedule Management


---


# BIM to Schedule 4D Integration

## Technical Implementation

```python
import pandas as pd
from datetime import date, timedelta
from typing import Dict, Any, List, Optional
from dataclasses import dataclass, field
from enum import Enum


class LinkStatus(Enum):
    LINKED = "linked"
    UNLINKED = "unlinked"
    PARTIAL = "partial"


@dataclass
class ScheduleActivity:
    activity_id: str
    activity_name: str
    start_date: date
    end_date: date
    duration_days: int
    wbs_code: str
    predecessors: List[str] = field(default_factory=list)


@dataclass
class BIMElement:
    element_id: str
    element_name: str
    category: str
    level: str
    zone: str
    volume: float = 0
    area: float = 0


@dataclass
class BIMScheduleLink:
    link_id: str
    activity_id: str
    element_ids: List[str]
    link_type: str  # install, remove, temporary
    status: LinkStatus


class BIMSchedule4D:
    def __init__(self, project_name: str):
        self.project_name = project_name
        self.activities: Dict[str, ScheduleActivity] = {}
        self.elements: Dict[str, BIMElement] = {}
        self.links: Dict[str, BIMScheduleLink] = {}
        self._link_counter = 0

    def import_schedule(self, schedule_data: List[Dict[str, Any]]):
        for act in schedule_data:
            activity = ScheduleActivity(
                activity_id=act['id'],
                activity_name=act['name'],
                start_date=act['start'],
                end_date=act['end'],
                duration_days=(act['end'] - act['start']).days,
                wbs_code=act.get('wbs', ''),
                predecessors=act.get('predecessors', [])
            )
            self.activities[activity.activity_id] = activity

    def import_elements(self, element_data: List[Dict[str, Any]]):
        for elem in element_data:
            element = BIMElement(
                element_id=elem['id'],
                element_name=elem['name'],
                category=elem['category'],
                level=elem.get('level', ''),
                zone=elem.get('zone', ''),
                volume=elem.get('volume', 0),
                area=elem.get('area', 0)
            )
            self.elements[element.element_id] = element

    def create_link(self, activity_id: str, element_ids: List[str],
                   link_type: str = "install") -> BIMScheduleLink:
        if activity_id not in self.activities:
            return None

        self._link_counter += 1
        link_id = f"LNK-{self._link_counter:05d}"

        # Verify elements exist
        valid_elements = [eid for eid in element_ids if eid in self.elements]

        status = LinkStatus.LINKED if valid_elements else LinkStatus.UNLINKED
        if valid_elements and len(valid_elements) < len(element_ids):
            status = LinkStatus.PARTIAL

        link = BIMScheduleLink(
            link_id=link_id,
            activity_id=activity_id,
            element_ids=valid_elements,
            link_type=link_type,
            status=status
        )
        self.links[link_id] = link
        return link

    def auto_link_by_level(self, level: str, activity_id: str):
        """Auto-link all elements on a level to an activity."""
        level_elements = [e.element_id for e in self.elements.values()
                        if e.level == level]
        if level_elements:
            return self.create_link(activity_id, level_elements)
        return None

    def get_elements_for_date(self, target_date: date) -> List[BIMElement]:
        """Get elements that should be visible on a specific date."""
        visible_elements = []
        for link in self.links.values():
            activity = self.activities.get(link.activity_id)
            if activity and activity.start_date <= target_date <= activity.end_date:
                for elem_id in link.element_ids:
                    if elem_id in self.elements:
                        visible_elements.append(self.elements[elem_id])
        return visible_elements

    def get_unlinked_elements(self) -> List[BIMElement]:
        linked_ids = set()
        for link in self.links.values():
            linked_ids.update(link.element_ids)
        return [e for e in self.elements.values() if e.element_id not in linked_ids]

    def get_unlinked_activities(self) -> List[ScheduleActivity]:
        linked_activities = {link.activity_id for link in self.links.values()}
        return [a for a in self.activities.values() if a.activity_id not in linked_activities]

    def get_link_summary(self) -> Dict[str, Any]:
        total_elements = len(self.elements)
        linked_elements = len(set(
            eid for link in self.links.values() for eid in link.element_ids
        ))

        return {
            'total_activities': len(self.activities),
            'total_elements': total_elements,
            'linked_elements': linked_elements,
            'unlinked_elements': total_elements - linked_elements,
            'total_links': len(self.links),
            'link_coverage': round(linked_elements / total_elements * 100, 1) if total_elements > 0 else 0
        }

    def export_links(self, output_path: str):
        data = []
        for link in self.links.values():
            activity = self.activities.get(link.activity_id)
            data.append({
                'Link ID': link.link_id,
                'Activity': activity.activity_name if activity else '',
                'Start': activity.start_date if activity else None,
                'End': activity.end_date if activity else None,
                'Elements': len(link.element_ids),
                'Type': link.link_type,
                'Status': link.status.value
            })
        pd.DataFrame(data).to_excel(output_path, index=False)
```

## Quick Start

```python
bim4d = BIMSchedule4D("Office Tower")

# Import schedule
bim4d.import_schedule([
    {'id': 'A100', 'name': 'Foundation', 'start': date(2024, 1, 1), 'end': date(2024, 2, 28)},
    {'id': 'A200', 'name': 'Structure L1', 'start': date(2024, 3, 1), 'end': date(2024, 4, 30)}
])

# Import elements
bim4d.import_elements([
    {'id': 'E001', 'name': 'Footing F1', 'category': 'Foundation', 'level': 'Foundation'},
    {'id': 'E002', 'name': 'Column C1', 'category': 'Structure', 'level': 'Level 1'}
])

# Create links
bim4d.create_link('A100', ['E001'])
bim4d.create_link('A200', ['E002'])

summary = bim4d.get_link_summary()
print(f"Link coverage: {summary['link_coverage']}%")
```

## Resources
- **Jens Book**: Chapter 3.3 - 4D BIM


---


# Schedule-Cost Linker

## Business Case

### Problem Statement
Integrating schedule and cost requires:
- Linking activities to budget items
- Creating cost-loaded schedules
- Generating cash flow forecasts
- Tracking earned value metrics

### Solution
Systematic linkage between schedule activities and cost data to enable integrated project control.

## Technical Implementation

```python
import pandas as pd
import numpy as np
from typing import Dict, Any, List, Optional, Tuple
from dataclasses import dataclass, field
from datetime import date, timedelta
from enum import Enum
from collections import defaultdict


class LoadingMethod(Enum):
    UNIFORM = "uniform"          # Even distribution
    FRONT_LOADED = "front_loaded"
    BACK_LOADED = "back_loaded"
    BELL_CURVE = "bell_curve"


@dataclass
class ScheduleActivity:
    activity_id: str
    name: str
    start_date: date
    finish_date: date
    duration: int
    percent_complete: float = 0


@dataclass
class CostItem:
    cost_code: str
    description: str
    budgeted_cost: float
    labor_cost: float
    material_cost: float
    equipment_cost: float


@dataclass
class ActivityCostLink:
    activity_id: str
    cost_code: str
    budgeted_cost: float
    loading_method: LoadingMethod


@dataclass
class EarnedValueMetrics:
    data_date: date
    bcws: float  # Budgeted Cost of Work Scheduled (PV)
    bcwp: float  # Budgeted Cost of Work Performed (EV)
    acwp: float  # Actual Cost of Work Performed (AC)
    sv: float    # Schedule Variance
    cv: float    # Cost Variance
    spi: float   # Schedule Performance Index
    cpi: float   # Cost Performance Index
    eac: float   # Estimate at Completion
    etc: float   # Estimate to Complete
    vac: float   # Variance at Completion


class ScheduleCostLinker:
    """Link schedule activities to cost items."""

    def __init__(self, project_name: str, budget_at_completion: float):
        self.project_name = project_name
        self.bac = budget_at_completion
        self.activities: Dict[str, ScheduleActivity] = {}
        self.cost_items: Dict[str, CostItem] = {}
        self.links: List[ActivityCostLink] = []
        self.actual_costs: Dict[str, float] = {}  # activity_id -> actual cost

    def add_activity(self,
                     activity_id: str,
                     name: str,
                     start_date: date,
                     finish_date: date,
                     percent_complete: float = 0):
        """Add schedule activity."""

        duration = (finish_date - start_date).days + 1

        self.activities[activity_id] = ScheduleActivity(
            activity_id=activity_id,
            name=name,
            start_date=start_date,
            finish_date=finish_date,
            duration=duration,
            percent_complete=percent_complete
        )

    def add_cost_item(self,
                      cost_code: str,
                      description: str,
                      budgeted_cost: float,
                      labor_pct: float = 0.4,
                      material_pct: float = 0.5,
                      equipment_pct: float = 0.1):
        """Add cost item."""

        self.cost_items[cost_code] = CostItem(
            cost_code=cost_code,
            description=description,
            budgeted_cost=budgeted_cost,
            labor_cost=budgeted_cost * labor_pct,
            material_cost=budgeted_cost * material_pct,
            equipment_cost=budgeted_cost * equipment_pct
        )

    def link_activity_cost(self,
                           activity_id: str,
                           cost_code: str,
                           loading_method: LoadingMethod = LoadingMethod.UNIFORM):
        """Link activity to cost item."""

        if activity_id not in self.activities:
            return

        cost_item = self.cost_items.get(cost_code)
        budgeted = cost_item.budgeted_cost if cost_item else 0

        self.links.append(ActivityCostLink(
            activity_id=activity_id,
            cost_code=cost_code,
            budgeted_cost=budgeted,
            loading_method=loading_method
        ))

    def record_actual_cost(self, activity_id: str, actual_cost: float):
        """Record actual cost for activity."""
        self.actual_costs[activity_id] = actual_cost

    def _distribute_cost(self,
                          cost: float,
                          start_date: date,
                          duration: int,
                          method: LoadingMethod) -> Dict[date, float]:
        """Distribute cost over activity duration."""

        daily_costs = {}

        if duration <= 0:
            return {start_date: cost}

        if method == LoadingMethod.UNIFORM:
            daily = cost / duration
            for i in range(duration):
                daily_costs[start_date + timedelta(days=i)] = daily

        elif method == LoadingMethod.FRONT_LOADED:
            total_weight = sum(range(duration, 0, -1))
            for i in range(duration):
                weight = (duration - i) / total_weight
                daily_costs[start_date + timedelta(days=i)] = cost * weight

        elif method == LoadingMethod.BACK_LOADED:
            total_weight = sum(range(1, duration + 1))
            for i in range(duration):
                weight = (i + 1) / total_weight
                daily_costs[start_date + timedelta(days=i)] = cost * weight

        elif method == LoadingMethod.BELL_CURVE:
            # Simplified bell curve
            mid = duration / 2
            for i in range(duration):
                distance = abs(i - mid)
                weight = 1 - (distance / mid) * 0.5
                daily_costs[start_date + timedelta(days=i)] = cost * weight / duration

        return daily_costs

    def generate_cost_loaded_schedule(self) -> pd.DataFrame:
        """Generate cost-loaded schedule."""

        data = []

        for link in self.links:
            activity = self.activities.get(link.activity_id)
            cost_item = self.cost_items.get(link.cost_code)

            if activity and cost_item:
                data.append({
                    'Activity ID': activity.activity_id,
                    'Activity Name': activity.name,
                    'Cost Code': link.cost_code,
                    'Description': cost_item.description,
                    'Start': activity.start_date,
                    'Finish': activity.finish_date,
                    'Duration': activity.duration,
                    'Budget': link.budgeted_cost,
                    '% Complete': activity.percent_complete,
                    'Earned Value': link.budgeted_cost * activity.percent_complete / 100,
                    'Loading': link.loading_method.value
                })

        return pd.DataFrame(data)

    def generate_cash_flow(self,
                           project_start: date = None,
                           project_end: date = None) -> pd.DataFrame:
        """Generate cash flow curve."""

        if not self.links:
            return pd.DataFrame()

        # Get date range
        if project_start is None:
            project_start = min(self.activities[l.activity_id].start_date for l in self.links)
        if project_end is None:
            project_end = max(self.activities[l.activity_id].finish_date for l in self.links)

        # Aggregate daily costs
        daily_totals = defaultdict(float)

        for link in self.links:
            activity = self.activities.get(link.activity_id)
            if not activity:
                continue

            daily_costs = self._distribute_cost(
                link.budgeted_cost,
                activity.start_date,
                activity.duration,
                link.loading_method
            )

            for day, cost in daily_costs.items():
                daily_totals[day] += cost

        # Build cash flow data
        data = []
        cumulative = 0
        current = project_start

        while current <= project_end:
            daily = daily_totals.get(current, 0)
            cumulative += daily

            data.append({
                'Date': current,
                'Daily': round(daily, 2),
                'Cumulative': round(cumulative, 2),
                'Cumulative %': round(cumulative / self.bac * 100, 1) if self.bac > 0 else 0
            })

            current += timedelta(days=1)

        return pd.DataFrame(data)

    def calculate_earned_value(self, data_date: date) -> EarnedValueMetrics:
        """Calculate earned value metrics at data date."""

        # BCWS - Planned Value through data date
        bcws = 0
        for link in self.links:
            activity = self.activities.get(link.activity_id)
            if not activity:
                continue

            daily_costs = self._distribute_cost(
                link.budgeted_cost,
                activity.start_date,
                activity.duration,
                link.loading_method
            )

            for day, cost in daily_costs.items():
                if day <= data_date:
                    bcws += cost

        # BCWP - Earned Value (budget * % complete)
        bcwp = 0
        for link in self.links:
            activity = self.activities.get(link.activity_id)
            if activity:
                bcwp += link.budgeted_cost * activity.percent_complete / 100

        # ACWP - Actual Cost
        acwp = sum(self.actual_costs.values())

        # Variances
        sv = bcwp - bcws
        cv = bcwp - acwp

        # Indices
        spi = bcwp / bcws if bcws > 0 else 0
        cpi = bcwp / acwp if acwp > 0 else 0

        # Forecasts
        eac = self.bac / cpi if cpi > 0 else self.bac
        etc = eac - acwp
        vac = self.bac - eac

        return EarnedValueMetrics(
            data_date=data_date,
            bcws=round(bcws, 2),
            bcwp=round(bcwp, 2),
            acwp=round(acwp, 2),
            sv=round(sv, 2),
            cv=round(cv, 2),
            spi=round(spi, 2),
            cpi=round(cpi, 2),
            eac=round(eac, 2),
            etc=round(etc, 2),
            vac=round(vac, 2)
        )

    def get_monthly_cash_flow(self) -> pd.DataFrame:
        """Aggregate cash flow by month."""

        daily = self.generate_cash_flow()
        if daily.empty:
            return pd.DataFrame()

        daily['Month'] = pd.to_datetime(daily['Date']).dt.to_period('M')
        monthly = daily.groupby('Month').agg({
            'Daily': 'sum',
            'Cumulative': 'last'
        }).reset_index()

        monthly.columns = ['Month', 'Monthly Cost', 'Cumulative']
        return monthly

    def export_to_excel(self, output_path: str) -> str:
        """Export integrated data to Excel."""

        with pd.ExcelWriter(output_path, engine='openpyxl') as writer:
            # Cost-loaded schedule
            schedule = self.generate_cost_loaded_schedule()
            schedule.to_excel(writer, sheet_name='Cost-Loaded Schedule', index=False)

            # Cash flow
            cash_flow = self.generate_cash_flow()
            if not cash_flow.empty:
                cash_flow.to_excel(writer, sheet_name='Cash Flow', index=False)

            # Monthly
            monthly = self.get_monthly_cash_flow()
            if not monthly.empty:
                monthly.to_excel(writer, sheet_name='Monthly', index=False)

            # Earned Value
            evm = self.calculate_earned_value(date.today())
            evm_df = pd.DataFrame([{
                'Data Date': evm.data_date,
                'BCWS (PV)': evm.bcws,
                'BCWP (EV)': evm.bcwp,
                'ACWP (AC)': evm.acwp,
                'SV': evm.sv,
                'CV': evm.cv,
                'SPI': evm.spi,
                'CPI': evm.cpi,
                'EAC': evm.eac,
                'ETC': evm.etc,
                'VAC': evm.vac
            }])
            evm_df.to_excel(writer, sheet_name='Earned Value', index=False)

        return output_path
```

## Quick Start

```python
from datetime import date, timedelta

# Initialize linker
linker = ScheduleCostLinker("Office Building", budget_at_completion=5000000)

# Add activities
linker.add_activity("A-001", "Foundation", date(2024, 6, 1), date(2024, 6, 30), percent_complete=100)
linker.add_activity("A-002", "Structure", date(2024, 7, 1), date(2024, 9, 30), percent_complete=60)
linker.add_activity("A-003", "MEP", date(2024, 8, 1), date(2024, 11, 30), percent_complete=30)

# Add cost items
linker.add_cost_item("01-FOUND", "Foundation Work", 500000)
linker.add_cost_item("02-STRUCT", "Structural Work", 2000000)
linker.add_cost_item("03-MEP", "MEP Systems", 1500000)

# Link
linker.link_activity_cost("A-001", "01-FOUND")
linker.link_activity_cost("A-002", "02-STRUCT", LoadingMethod.BELL_CURVE)
linker.link_activity_cost("A-003", "03-MEP", LoadingMethod.BACK_LOADED)

# Record actuals
linker.record_actual_cost("A-001", 520000)
linker.record_actual_cost("A-002", 1300000)
```

## Common Use Cases

### 1. Earned Value Analysis
```python
evm = linker.calculate_earned_value(date.today())
print(f"CPI: {evm.cpi}")
print(f"SPI: {evm.spi}")
print(f"EAC: ${evm.eac:,.2f}")
```

### 2. Cash Flow Forecast
```python
cash_flow = linker.generate_cash_flow()
print(cash_flow.tail(10))
```

### 3. Monthly Breakdown
```python
monthly = linker.get_monthly_cash_flow()
print(monthly)
```

## Resources
- **Jens Book**: Chapter 4.2 - Schedule-Cost Integration


---


# Weather Impact Scheduler

## Technical Implementation

```python
import pandas as pd
from datetime import date, timedelta
from typing import Dict, Any, List, Optional
from dataclasses import dataclass, field
from enum import Enum


class WeatherCondition(Enum):
    CLEAR = "clear"
    CLOUDY = "cloudy"
    RAIN = "rain"
    HEAVY_RAIN = "heavy_rain"
    SNOW = "snow"
    WIND = "wind"
    EXTREME_HEAT = "extreme_heat"
    EXTREME_COLD = "extreme_cold"


class ActivitySensitivity(Enum):
    HIGH = "high"      # Concrete, painting, roofing
    MEDIUM = "medium"  # Excavation, masonry
    LOW = "low"        # Indoor work


@dataclass
class WeatherForecast:
    forecast_date: date
    condition: WeatherCondition
    high_temp: float
    low_temp: float
    precipitation_mm: float
    wind_speed_kmh: float


@dataclass
class ScheduleActivity:
    activity_id: str
    name: str
    start_date: date
    end_date: date
    sensitivity: ActivitySensitivity
    outdoor: bool
    can_work_in_rain: bool = False
    min_temp: float = 5.0
    max_temp: float = 35.0
    max_wind: float = 50.0


@dataclass
class WeatherImpact:
    activity_id: str
    impact_date: date
    reason: str
    delay_hours: float
    recommendation: str


class WeatherImpactScheduler:
    def __init__(self, project_name: str):
        self.project_name = project_name
        self.activities: Dict[str, ScheduleActivity] = {}
        self.forecasts: Dict[date, WeatherForecast] = {}
        self.impacts: List[WeatherImpact] = []

    def add_activity(self, activity_id: str, name: str, start_date: date,
                    end_date: date, sensitivity: ActivitySensitivity,
                    outdoor: bool = True, can_work_in_rain: bool = False) -> ScheduleActivity:
        activity = ScheduleActivity(
            activity_id=activity_id,
            name=name,
            start_date=start_date,
            end_date=end_date,
            sensitivity=sensitivity,
            outdoor=outdoor,
            can_work_in_rain=can_work_in_rain
        )
        self.activities[activity_id] = activity
        return activity

    def add_forecast(self, forecast_date: date, condition: WeatherCondition,
                    high_temp: float, low_temp: float,
                    precipitation_mm: float = 0, wind_speed_kmh: float = 0):
        forecast = WeatherForecast(
            forecast_date=forecast_date,
            condition=condition,
            high_temp=high_temp,
            low_temp=low_temp,
            precipitation_mm=precipitation_mm,
            wind_speed_kmh=wind_speed_kmh
        )
        self.forecasts[forecast_date] = forecast

    def analyze_impacts(self) -> List[WeatherImpact]:
        self.impacts = []

        for activity in self.activities.values():
            if not activity.outdoor:
                continue

            current = activity.start_date
            while current <= activity.end_date:
                forecast = self.forecasts.get(current)
                if forecast:
                    impact = self._check_impact(activity, forecast)
                    if impact:
                        self.impacts.append(impact)
                current += timedelta(days=1)

        return self.impacts

    def _check_impact(self, activity: ScheduleActivity,
                     forecast: WeatherForecast) -> Optional[WeatherImpact]:
        reasons = []
        delay_hours = 0

        # Check precipitation
        if forecast.condition in [WeatherCondition.RAIN, WeatherCondition.HEAVY_RAIN]:
            if not activity.can_work_in_rain:
                if activity.sensitivity == ActivitySensitivity.HIGH:
                    reasons.append("Rain - high sensitivity activity")
                    delay_hours = 8
                else:
                    reasons.append("Rain delays")
                    delay_hours = 4

        # Check temperature
        if forecast.low_temp < activity.min_temp:
            reasons.append(f"Too cold ({forecast.low_temp}°C)")
            delay_hours = max(delay_hours, 8 if activity.sensitivity == ActivitySensitivity.HIGH else 4)

        if forecast.high_temp > activity.max_temp:
            reasons.append(f"Too hot ({forecast.high_temp}°C)")
            delay_hours = max(delay_hours, 4)

        # Check wind
        if forecast.wind_speed_kmh > activity.max_wind:
            reasons.append(f"High wind ({forecast.wind_speed_kmh} km/h)")
            delay_hours = max(delay_hours, 8)

        if reasons:
            return WeatherImpact(
                activity_id=activity.activity_id,
                impact_date=forecast.forecast_date,
                reason="; ".join(reasons),
                delay_hours=delay_hours,
                recommendation=self._get_recommendation(activity, forecast)
            )
        return None

    def _get_recommendation(self, activity: ScheduleActivity,
                           forecast: WeatherForecast) -> str:
        if forecast.condition in [WeatherCondition.RAIN, WeatherCondition.HEAVY_RAIN]:
            return "Reschedule or plan indoor work"
        if forecast.low_temp < activity.min_temp:
            return "Use heating blankets or delay start"
        if forecast.high_temp > activity.max_temp:
            return "Start early, plan heat breaks"
        if forecast.wind_speed_kmh > activity.max_wind:
            return "Secure materials, delay crane work"
        return "Monitor conditions"

    def get_total_delay_forecast(self) -> Dict[str, Any]:
        total_hours = sum(i.delay_hours for i in self.impacts)
        by_activity = {}
        for impact in self.impacts:
            act = impact.activity_id
            by_activity[act] = by_activity.get(act, 0) + impact.delay_hours

        return {
            'total_impact_hours': total_hours,
            'total_impact_days': round(total_hours / 8, 1),
            'affected_activities': len(by_activity),
            'by_activity': by_activity,
            'impact_count': len(self.impacts)
        }

    def export_analysis(self, output_path: str):
        data = [{
            'Activity': i.activity_id,
            'Date': i.impact_date,
            'Reason': i.reason,
            'Delay Hours': i.delay_hours,
            'Recommendation': i.recommendation
        } for i in self.impacts]
        pd.DataFrame(data).to_excel(output_path, index=False)
```

## Quick Start

```python
scheduler = WeatherImpactScheduler("Office Tower")

# Add activities
scheduler.add_activity("CONC-001", "Pour Slab L3", date(2024, 3, 15),
                      date(2024, 3, 20), ActivitySensitivity.HIGH, outdoor=True)

# Add forecasts
scheduler.add_forecast(date(2024, 3, 17), WeatherCondition.RAIN, 15, 8, 25, 20)

# Analyze
impacts = scheduler.analyze_impacts()
summary = scheduler.get_total_delay_forecast()
print(f"Projected delay: {summary['total_impact_days']} days")
```

## Resources
- **Jens Book**: Chapter 3.3 - Schedule Management


---

