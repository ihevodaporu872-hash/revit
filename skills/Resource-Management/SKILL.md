# Resource-Management Skills

Consolidated skill reference for Resource-Management operations.

---

# Equipment Fleet Manager

## Technical Implementation

```python
import pandas as pd
from datetime import date, timedelta
from typing import Dict, Any, List, Optional
from dataclasses import dataclass, field
from enum import Enum


class EquipmentStatus(Enum):
    AVAILABLE = "available"
    IN_USE = "in_use"
    MAINTENANCE = "maintenance"
    REPAIR = "repair"
    RETIRED = "retired"


class EquipmentType(Enum):
    CRANE = "crane"
    EXCAVATOR = "excavator"
    LOADER = "loader"
    FORKLIFT = "forklift"
    GENERATOR = "generator"
    COMPRESSOR = "compressor"
    SCAFFOLDING = "scaffolding"
    OTHER = "other"


@dataclass
class MaintenanceRecord:
    record_id: str
    equipment_id: str
    maintenance_type: str
    scheduled_date: date
    completed_date: Optional[date]
    cost: float
    notes: str = ""


@dataclass
class Assignment:
    assignment_id: str
    equipment_id: str
    project: str
    location: str
    start_date: date
    end_date: Optional[date]
    operator: str = ""


@dataclass
class Equipment:
    equipment_id: str
    name: str
    equipment_type: EquipmentType
    make: str
    model: str
    year: int
    status: EquipmentStatus
    hourly_rate: float
    daily_rate: float
    current_hours: float = 0
    last_maintenance: Optional[date] = None
    next_maintenance_hours: float = 500
    assignments: List[Assignment] = field(default_factory=list)


class EquipmentFleetManager:
    def __init__(self, company_name: str):
        self.company_name = company_name
        self.equipment: Dict[str, Equipment] = {}
        self.maintenance_records: List[MaintenanceRecord] = {}
        self._equip_counter = 0
        self._assign_counter = 0

    def add_equipment(self, name: str, equipment_type: EquipmentType,
                     make: str, model: str, year: int,
                     hourly_rate: float, daily_rate: float) -> Equipment:
        self._equip_counter += 1
        equip_id = f"EQ-{self._equip_counter:04d}"

        equip = Equipment(
            equipment_id=equip_id,
            name=name,
            equipment_type=equipment_type,
            make=make,
            model=model,
            year=year,
            status=EquipmentStatus.AVAILABLE,
            hourly_rate=hourly_rate,
            daily_rate=daily_rate
        )
        self.equipment[equip_id] = equip
        return equip

    def assign_equipment(self, equip_id: str, project: str, location: str,
                        start_date: date, operator: str = "") -> Assignment:
        if equip_id not in self.equipment:
            return None

        self._assign_counter += 1
        assign_id = f"ASN-{self._assign_counter:04d}"

        assignment = Assignment(
            assignment_id=assign_id,
            equipment_id=equip_id,
            project=project,
            location=location,
            start_date=start_date,
            end_date=None,
            operator=operator
        )

        self.equipment[equip_id].assignments.append(assignment)
        self.equipment[equip_id].status = EquipmentStatus.IN_USE
        return assignment

    def return_equipment(self, equip_id: str, hours_used: float):
        if equip_id in self.equipment:
            equip = self.equipment[equip_id]
            equip.status = EquipmentStatus.AVAILABLE
            equip.current_hours += hours_used
            if equip.assignments:
                equip.assignments[-1].end_date = date.today()

    def schedule_maintenance(self, equip_id: str, maintenance_type: str,
                            scheduled_date: date, cost: float):
        if equip_id not in self.equipment:
            return
        record_id = f"MNT-{len(self.maintenance_records) + 1:04d}"
        record = MaintenanceRecord(record_id, equip_id, maintenance_type,
                                  scheduled_date, None, cost)
        self.maintenance_records[record_id] = record

    def get_available_equipment(self, equipment_type: EquipmentType = None) -> List[Equipment]:
        available = [e for e in self.equipment.values()
                    if e.status == EquipmentStatus.AVAILABLE]
        if equipment_type:
            available = [e for e in available if e.equipment_type == equipment_type]
        return available

    def get_utilization_report(self) -> Dict[str, Any]:
        in_use = sum(1 for e in self.equipment.values()
                    if e.status == EquipmentStatus.IN_USE)
        total = len(self.equipment)
        return {
            'total_equipment': total,
            'in_use': in_use,
            'available': sum(1 for e in self.equipment.values()
                            if e.status == EquipmentStatus.AVAILABLE),
            'maintenance': sum(1 for e in self.equipment.values()
                              if e.status == EquipmentStatus.MAINTENANCE),
            'utilization_rate': round(in_use / total * 100, 1) if total > 0 else 0
        }

    def export_fleet(self, output_path: str):
        data = [{
            'ID': e.equipment_id,
            'Name': e.name,
            'Type': e.equipment_type.value,
            'Make/Model': f"{e.make} {e.model}",
            'Year': e.year,
            'Status': e.status.value,
            'Hours': e.current_hours,
            'Daily Rate': e.daily_rate
        } for e in self.equipment.values()]
        pd.DataFrame(data).to_excel(output_path, index=False)
```

## Quick Start

```python
fleet = EquipmentFleetManager("ABC Construction")

crane = fleet.add_equipment("Tower Crane #1", EquipmentType.CRANE,
                           "Liebherr", "280 EC-H", 2020, 150, 1200)

assignment = fleet.assign_equipment(crane.equipment_id, "Office Tower",
                                   "Site A", date.today(), "John Smith")

report = fleet.get_utilization_report()
print(f"Utilization: {report['utilization_rate']}%")
```

## Resources
- **Jens Book**: Chapter 3.2 - Resource Management


---


# Labor Allocation Manager

## Business Case

### Problem Statement
Labor management challenges:
- Assigning workers to activities
- Balancing workload
- Tracking attendance
- Optimizing productivity

### Solution
Systematic labor allocation and tracking to optimize resource utilization and maintain project schedule.

## Technical Implementation

```python
import pandas as pd
from typing import Dict, Any, List, Optional
from dataclasses import dataclass, field
from datetime import date, timedelta
from enum import Enum
from collections import defaultdict


class Trade(Enum):
    CARPENTER = "carpenter"
    ELECTRICIAN = "electrician"
    PLUMBER = "plumber"
    CONCRETE = "concrete"
    MASON = "mason"
    IRONWORKER = "ironworker"
    HVAC = "hvac"
    PAINTER = "painter"
    LABORER = "laborer"
    OPERATOR = "operator"
    FOREMAN = "foreman"


class WorkerStatus(Enum):
    AVAILABLE = "available"
    ASSIGNED = "assigned"
    ON_LEAVE = "on_leave"
    SICK = "sick"
    TERMINATED = "terminated"


class SkillLevel(Enum):
    APPRENTICE = "apprentice"
    JOURNEYMAN = "journeyman"
    MASTER = "master"


@dataclass
class Worker:
    worker_id: str
    name: str
    trade: Trade
    skill_level: SkillLevel
    hourly_rate: float
    company: str
    status: WorkerStatus = WorkerStatus.AVAILABLE
    certifications: List[str] = field(default_factory=list)


@dataclass
class Assignment:
    assignment_id: str
    worker_id: str
    activity_id: str
    activity_name: str
    start_date: date
    end_date: date
    hours_per_day: float
    location: str


@dataclass
class AttendanceRecord:
    date: date
    worker_id: str
    activity_id: str
    hours_worked: float
    overtime_hours: float
    status: str  # present, absent, late


class LaborAllocation:
    """Manage labor allocation and tracking."""

    def __init__(self, project_name: str):
        self.project_name = project_name
        self.workers: Dict[str, Worker] = {}
        self.assignments: List[Assignment] = []
        self.attendance: List[AttendanceRecord] = []

    def add_worker(self,
                   worker_id: str,
                   name: str,
                   trade: Trade,
                   skill_level: SkillLevel,
                   hourly_rate: float,
                   company: str,
                   certifications: List[str] = None) -> Worker:
        """Add worker to pool."""

        worker = Worker(
            worker_id=worker_id,
            name=name,
            trade=trade,
            skill_level=skill_level,
            hourly_rate=hourly_rate,
            company=company,
            certifications=certifications or []
        )

        self.workers[worker_id] = worker
        return worker

    def assign_worker(self,
                      worker_id: str,
                      activity_id: str,
                      activity_name: str,
                      start_date: date,
                      end_date: date,
                      hours_per_day: float = 8,
                      location: str = "") -> Optional[Assignment]:
        """Assign worker to activity."""

        if worker_id not in self.workers:
            return None

        worker = self.workers[worker_id]

        # Check for conflicts
        conflicts = self.check_conflicts(worker_id, start_date, end_date)
        if conflicts:
            print(f"Warning: Worker has {len(conflicts)} conflicting assignments")

        assignment = Assignment(
            assignment_id=f"ASN-{len(self.assignments)+1:04d}",
            worker_id=worker_id,
            activity_id=activity_id,
            activity_name=activity_name,
            start_date=start_date,
            end_date=end_date,
            hours_per_day=hours_per_day,
            location=location
        )

        self.assignments.append(assignment)
        worker.status = WorkerStatus.ASSIGNED

        return assignment

    def check_conflicts(self,
                        worker_id: str,
                        start_date: date,
                        end_date: date) -> List[Assignment]:
        """Check for scheduling conflicts."""

        conflicts = []

        for assignment in self.assignments:
            if assignment.worker_id != worker_id:
                continue

            # Check overlap
            if not (end_date < assignment.start_date or start_date > assignment.end_date):
                conflicts.append(assignment)

        return conflicts

    def record_attendance(self,
                          date: date,
                          worker_id: str,
                          activity_id: str,
                          hours_worked: float,
                          overtime_hours: float = 0,
                          status: str = "present"):
        """Record worker attendance."""

        self.attendance.append(AttendanceRecord(
            date=date,
            worker_id=worker_id,
            activity_id=activity_id,
            hours_worked=hours_worked,
            overtime_hours=overtime_hours,
            status=status
        ))

    def get_workers_by_trade(self, trade: Trade) -> List[Worker]:
        """Get available workers by trade."""
        return [
            w for w in self.workers.values()
            if w.trade == trade and w.status in [WorkerStatus.AVAILABLE, WorkerStatus.ASSIGNED]
        ]

    def get_daily_roster(self, target_date: date) -> pd.DataFrame:
        """Get roster for specific date."""

        roster = []

        for assignment in self.assignments:
            if assignment.start_date <= target_date <= assignment.end_date:
                worker = self.workers.get(assignment.worker_id)
                if worker:
                    roster.append({
                        'Worker ID': worker.worker_id,
                        'Name': worker.name,
                        'Trade': worker.trade.value,
                        'Company': worker.company,
                        'Activity': assignment.activity_name,
                        'Location': assignment.location,
                        'Hours': assignment.hours_per_day
                    })

        return pd.DataFrame(roster)

    def get_activity_crew(self, activity_id: str) -> List[Dict[str, Any]]:
        """Get crew assigned to activity."""

        crew = []

        for assignment in self.assignments:
            if assignment.activity_id == activity_id:
                worker = self.workers.get(assignment.worker_id)
                if worker:
                    crew.append({
                        'worker_id': worker.worker_id,
                        'name': worker.name,
                        'trade': worker.trade.value,
                        'skill_level': worker.skill_level.value,
                        'hourly_rate': worker.hourly_rate,
                        'start_date': assignment.start_date,
                        'end_date': assignment.end_date
                    })

        return crew

    def calculate_labor_cost(self,
                              activity_id: str = None,
                              start_date: date = None,
                              end_date: date = None) -> Dict[str, Any]:
        """Calculate labor costs."""

        total_hours = 0
        total_overtime = 0
        total_cost = 0
        by_trade = defaultdict(float)

        for record in self.attendance:
            # Filter by activity
            if activity_id and record.activity_id != activity_id:
                continue

            # Filter by date
            if start_date and record.date < start_date:
                continue
            if end_date and record.date > end_date:
                continue

            worker = self.workers.get(record.worker_id)
            if not worker:
                continue

            regular_cost = record.hours_worked * worker.hourly_rate
            overtime_cost = record.overtime_hours * worker.hourly_rate * 1.5

            total_hours += record.hours_worked
            total_overtime += record.overtime_hours
            total_cost += regular_cost + overtime_cost
            by_trade[worker.trade.value] += regular_cost + overtime_cost

        return {
            'total_hours': round(total_hours, 1),
            'total_overtime': round(total_overtime, 1),
            'total_cost': round(total_cost, 2),
            'by_trade': dict(by_trade)
        }

    def get_utilization_report(self,
                                start_date: date,
                                end_date: date) -> pd.DataFrame:
        """Get worker utilization report."""

        data = []
        work_days = (end_date - start_date).days + 1
        available_hours = work_days * 8

        for worker in self.workers.values():
            # Get attendance records
            records = [
                r for r in self.attendance
                if r.worker_id == worker.worker_id
                and start_date <= r.date <= end_date
            ]

            worked_hours = sum(r.hours_worked + r.overtime_hours for r in records)
            utilization = (worked_hours / available_hours * 100) if available_hours > 0 else 0

            data.append({
                'Worker ID': worker.worker_id,
                'Name': worker.name,
                'Trade': worker.trade.value,
                'Available Hours': available_hours,
                'Worked Hours': round(worked_hours, 1),
                'Utilization %': round(utilization, 1)
            })

        return pd.DataFrame(data).sort_values('Utilization %', ascending=False)

    def forecast_labor_needs(self,
                              activities: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Forecast labor needs for activities."""

        needs = defaultdict(lambda: {'hours': 0, 'workers': 0})

        for activity in activities:
            trade = activity.get('trade', 'laborer')
            hours = activity.get('manhours', 0)
            duration = activity.get('duration_days', 1)

            workers_needed = hours / (duration * 8) if duration > 0 else 0

            needs[trade]['hours'] += hours
            needs[trade]['workers'] = max(needs[trade]['workers'], int(workers_needed) + 1)

        # Check availability
        for trade_name, requirement in needs.items():
            try:
                trade = Trade(trade_name)
                available = len(self.get_workers_by_trade(trade))
                requirement['available'] = available
                requirement['shortage'] = max(0, requirement['workers'] - available)
            except ValueError:
                requirement['available'] = 0
                requirement['shortage'] = requirement['workers']

        return dict(needs)

    def export_to_excel(self, output_path: str) -> str:
        """Export labor data to Excel."""

        with pd.ExcelWriter(output_path, engine='openpyxl') as writer:
            # Workers
            workers_df = pd.DataFrame([
                {
                    'ID': w.worker_id,
                    'Name': w.name,
                    'Trade': w.trade.value,
                    'Skill': w.skill_level.value,
                    'Rate': w.hourly_rate,
                    'Company': w.company,
                    'Status': w.status.value
                }
                for w in self.workers.values()
            ])
            workers_df.to_excel(writer, sheet_name='Workers', index=False)

            # Assignments
            assignments_df = pd.DataFrame([
                {
                    'ID': a.assignment_id,
                    'Worker': a.worker_id,
                    'Activity': a.activity_name,
                    'Start': a.start_date,
                    'End': a.end_date,
                    'Hours/Day': a.hours_per_day,
                    'Location': a.location
                }
                for a in self.assignments
            ])
            assignments_df.to_excel(writer, sheet_name='Assignments', index=False)

            # Roster for today
            roster = self.get_daily_roster(date.today())
            roster.to_excel(writer, sheet_name='Today Roster', index=False)

        return output_path
```

## Quick Start

```python
from datetime import date, timedelta

# Initialize manager
labor = LaborAllocation("Office Building A")

# Add workers
labor.add_worker("W001", "John Smith", Trade.CONCRETE, SkillLevel.JOURNEYMAN, 45, "ABC Concrete")
labor.add_worker("W002", "Mike Jones", Trade.CONCRETE, SkillLevel.APPRENTICE, 30, "ABC Concrete")
labor.add_worker("W003", "Tom Brown", Trade.CARPENTER, SkillLevel.MASTER, 55, "XYZ Carpentry")

# Assign to activity
labor.assign_worker(
    worker_id="W001",
    activity_id="A-101",
    activity_name="Pour Slab Level 3",
    start_date=date.today(),
    end_date=date.today() + timedelta(days=5),
    hours_per_day=10,
    location="Level 3"
)

# Record attendance
labor.record_attendance(date.today(), "W001", "A-101", hours_worked=10, overtime_hours=2)
```

## Common Use Cases

### 1. Daily Roster
```python
roster = labor.get_daily_roster(date.today())
print(roster)
```

### 2. Labor Cost
```python
cost = labor.calculate_labor_cost(activity_id="A-101")
print(f"Total Cost: ${cost['total_cost']:,.2f}")
```

### 3. Forecast Needs
```python
activities = [
    {'trade': 'concrete', 'manhours': 400, 'duration_days': 5},
    {'trade': 'carpenter', 'manhours': 200, 'duration_days': 10}
]
needs = labor.forecast_labor_needs(activities)
print(needs)
```

## Resources
- **Jens Book**: Chapter 3.1 - Labor Management


---


# Labor Productivity Analyzer

## Technical Implementation

```python
import pandas as pd
from datetime import date
from typing import Dict, Any, List
from dataclasses import dataclass, field
from enum import Enum


class ProductivityStatus(Enum):
    EXCEEDING = "exceeding"
    ON_TARGET = "on_target"
    BELOW_TARGET = "below_target"
    CRITICAL = "critical"


@dataclass
class ProductivityEntry:
    entry_id: str
    date: date
    trade: str
    activity_code: str
    activity_description: str
    location: str
    crew_size: int
    hours_worked: float
    quantity_installed: float
    unit: str
    target_productivity: float  # units per hour

    @property
    def actual_productivity(self) -> float:
        if self.hours_worked == 0:
            return 0
        return self.quantity_installed / self.hours_worked

    @property
    def productivity_factor(self) -> float:
        if self.target_productivity == 0:
            return 0
        return self.actual_productivity / self.target_productivity

    @property
    def status(self) -> ProductivityStatus:
        pf = self.productivity_factor
        if pf >= 1.1:
            return ProductivityStatus.EXCEEDING
        elif pf >= 0.9:
            return ProductivityStatus.ON_TARGET
        elif pf >= 0.7:
            return ProductivityStatus.BELOW_TARGET
        return ProductivityStatus.CRITICAL


class LaborProductivityAnalyzer:
    def __init__(self, project_name: str):
        self.project_name = project_name
        self.entries: List[ProductivityEntry] = []
        self.targets: Dict[str, float] = {}  # activity_code: target_productivity
        self._counter = 0

    def set_target(self, activity_code: str, target_productivity: float):
        self.targets[activity_code] = target_productivity

    def add_entry(self, entry_date: date, trade: str, activity_code: str,
                 activity_description: str, location: str, crew_size: int,
                 hours_worked: float, quantity_installed: float,
                 unit: str) -> ProductivityEntry:
        self._counter += 1
        entry_id = f"PROD-{self._counter:05d}"

        target = self.targets.get(activity_code, 1.0)

        entry = ProductivityEntry(
            entry_id=entry_id,
            date=entry_date,
            trade=trade,
            activity_code=activity_code,
            activity_description=activity_description,
            location=location,
            crew_size=crew_size,
            hours_worked=hours_worked,
            quantity_installed=quantity_installed,
            unit=unit,
            target_productivity=target
        )
        self.entries.append(entry)
        return entry

    def get_productivity_by_trade(self) -> Dict[str, Dict[str, Any]]:
        by_trade = {}
        for entry in self.entries:
            if entry.trade not in by_trade:
                by_trade[entry.trade] = {'hours': 0, 'quantity': 0, 'entries': 0}
            by_trade[entry.trade]['hours'] += entry.hours_worked
            by_trade[entry.trade]['quantity'] += entry.quantity_installed
            by_trade[entry.trade]['entries'] += 1

        for trade in by_trade:
            hours = by_trade[trade]['hours']
            qty = by_trade[trade]['quantity']
            by_trade[trade]['avg_productivity'] = qty / hours if hours > 0 else 0

        return by_trade

    def get_productivity_by_activity(self) -> Dict[str, Dict[str, Any]]:
        by_activity = {}
        for entry in self.entries:
            code = entry.activity_code
            if code not in by_activity:
                by_activity[code] = {
                    'description': entry.activity_description,
                    'hours': 0, 'quantity': 0, 'target': entry.target_productivity
                }
            by_activity[code]['hours'] += entry.hours_worked
            by_activity[code]['quantity'] += entry.quantity_installed

        for code in by_activity:
            hours = by_activity[code]['hours']
            qty = by_activity[code]['quantity']
            by_activity[code]['actual'] = qty / hours if hours > 0 else 0
            by_activity[code]['factor'] = (
                by_activity[code]['actual'] / by_activity[code]['target']
                if by_activity[code]['target'] > 0 else 0
            )

        return by_activity

    def get_low_performers(self) -> List[ProductivityEntry]:
        return [e for e in self.entries
                if e.status in [ProductivityStatus.BELOW_TARGET, ProductivityStatus.CRITICAL]]

    def get_summary(self) -> Dict[str, Any]:
        if not self.entries:
            return {'total_entries': 0}

        total_hours = sum(e.hours_worked for e in self.entries)
        factors = [e.productivity_factor for e in self.entries]
        avg_factor = sum(factors) / len(factors)

        return {
            'total_entries': len(self.entries),
            'total_hours': total_hours,
            'average_productivity_factor': round(avg_factor, 2),
            'exceeding': sum(1 for e in self.entries if e.status == ProductivityStatus.EXCEEDING),
            'on_target': sum(1 for e in self.entries if e.status == ProductivityStatus.ON_TARGET),
            'below_target': sum(1 for e in self.entries if e.status == ProductivityStatus.BELOW_TARGET),
            'critical': sum(1 for e in self.entries if e.status == ProductivityStatus.CRITICAL)
        }

    def export_report(self, output_path: str):
        data = [{
            'Date': e.date,
            'Trade': e.trade,
            'Activity': e.activity_code,
            'Location': e.location,
            'Crew': e.crew_size,
            'Hours': e.hours_worked,
            'Quantity': e.quantity_installed,
            'Unit': e.unit,
            'Target': e.target_productivity,
            'Actual': round(e.actual_productivity, 2),
            'Factor': round(e.productivity_factor, 2),
            'Status': e.status.value
        } for e in self.entries]
        pd.DataFrame(data).to_excel(output_path, index=False)
```

## Quick Start

```python
analyzer = LaborProductivityAnalyzer("Office Tower")

# Set targets
analyzer.set_target("CONC-001", 2.5)  # m3 per hour

# Add entry
entry = analyzer.add_entry(
    entry_date=date.today(),
    trade="Concrete",
    activity_code="CONC-001",
    activity_description="Pour concrete slab",
    location="Level 3",
    crew_size=8,
    hours_worked=80,
    quantity_installed=180,
    unit="m3"
)

print(f"Productivity factor: {entry.productivity_factor:.2f}")
print(f"Status: {entry.status.value}")
```

## Resources
- **Jens Book**: Chapter 3.2 - Resource Management


---

