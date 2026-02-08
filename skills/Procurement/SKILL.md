# Procurement Skills

Consolidated skill reference for Procurement operations.

---

# Bid Analysis Comparator

## Business Case

Bid evaluation requires systematic comparison across multiple criteria. This skill provides structured bid analysis and scoring.

## Technical Implementation

```python
import pandas as pd
from datetime import date
from typing import Dict, Any, List
from dataclasses import dataclass, field
from enum import Enum


class BidStatus(Enum):
    RECEIVED = "received"
    UNDER_REVIEW = "under_review"
    SHORTLISTED = "shortlisted"
    AWARDED = "awarded"
    REJECTED = "rejected"


@dataclass
class EvaluationCriteria:
    name: str
    weight: float  # 0-1
    max_score: int = 10


@dataclass
class BidScore:
    criteria: str
    score: int
    notes: str = ""


@dataclass
class Bid:
    bid_id: str
    bidder_name: str
    bid_package: str
    submitted_date: date
    base_bid: float
    alternates: Dict[str, float]
    status: BidStatus
    scores: List[BidScore] = field(default_factory=list)
    qualifications: List[str] = field(default_factory=list)
    exclusions: List[str] = field(default_factory=list)

    @property
    def total_weighted_score(self) -> float:
        return sum(s.score for s in self.scores)


class BidAnalysisComparator:
    def __init__(self, project_name: str, bid_package: str):
        self.project_name = project_name
        self.bid_package = bid_package
        self.bids: Dict[str, Bid] = {}
        self.criteria: List[EvaluationCriteria] = []
        self._setup_default_criteria()
        self._counter = 0

    def _setup_default_criteria(self):
        self.criteria = [
            EvaluationCriteria("Price", 0.35),
            EvaluationCriteria("Experience", 0.20),
            EvaluationCriteria("Schedule", 0.15),
            EvaluationCriteria("Safety Record", 0.10),
            EvaluationCriteria("References", 0.10),
            EvaluationCriteria("Capacity", 0.10)
        ]

    def add_bid(self, bidder_name: str, base_bid: float,
               submitted_date: date = None,
               alternates: Dict[str, float] = None) -> Bid:
        self._counter += 1
        bid_id = f"BID-{self._counter:03d}"

        bid = Bid(
            bid_id=bid_id,
            bidder_name=bidder_name,
            bid_package=self.bid_package,
            submitted_date=submitted_date or date.today(),
            base_bid=base_bid,
            alternates=alternates or {},
            status=BidStatus.RECEIVED
        )
        self.bids[bid_id] = bid
        return bid

    def score_bid(self, bid_id: str, scores: Dict[str, int]):
        """Score bid on criteria. scores = {'Price': 8, 'Experience': 7, ...}"""
        if bid_id not in self.bids:
            return
        bid = self.bids[bid_id]
        bid.scores = []
        for criteria, score in scores.items():
            bid.scores.append(BidScore(criteria, score))
        bid.status = BidStatus.UNDER_REVIEW

    def calculate_weighted_scores(self) -> pd.DataFrame:
        """Calculate weighted scores for all bids."""
        results = []
        criteria_weights = {c.name: c.weight for c in self.criteria}

        for bid in self.bids.values():
            row = {
                'Bidder': bid.bidder_name,
                'Base Bid': bid.base_bid,
                'Status': bid.status.value
            }
            total = 0
            for score in bid.scores:
                weight = criteria_weights.get(score.criteria, 0)
                weighted = score.score * weight * 10
                row[score.criteria] = score.score
                row[f'{score.criteria} (W)'] = round(weighted, 1)
                total += weighted
            row['Total Score'] = round(total, 1)
            results.append(row)

        return pd.DataFrame(results).sort_values('Total Score', ascending=False)

    def get_recommendation(self) -> Dict[str, Any]:
        """Get bid recommendation."""
        df = self.calculate_weighted_scores()
        if df.empty:
            return {'recommendation': 'No bids to evaluate'}

        top = df.iloc[0]
        lowest = df.sort_values('Base Bid').iloc[0]

        return {
            'highest_score': {
                'bidder': top['Bidder'],
                'score': top['Total Score'],
                'bid': top['Base Bid']
            },
            'lowest_price': {
                'bidder': lowest['Bidder'],
                'bid': lowest['Base Bid']
            },
            'total_bids': len(self.bids),
            'recommendation': top['Bidder']
        }

    def export_analysis(self, output_path: str):
        df = self.calculate_weighted_scores()
        with pd.ExcelWriter(output_path, engine='openpyxl') as writer:
            df.to_excel(writer, sheet_name='Comparison', index=False)

            # Bid details
            details = [{
                'Bidder': b.bidder_name,
                'Bid': b.base_bid,
                'Exclusions': '; '.join(b.exclusions),
                'Qualifications': '; '.join(b.qualifications)
            } for b in self.bids.values()]
            pd.DataFrame(details).to_excel(writer, sheet_name='Details', index=False)
```

## Quick Start

```python
comparator = BidAnalysisComparator("Office Tower", "Electrical")

bid1 = comparator.add_bid("ABC Electric", 850000)
bid2 = comparator.add_bid("XYZ Electric", 920000)

comparator.score_bid(bid1.bid_id, {'Price': 9, 'Experience': 7, 'Schedule': 8,
                                   'Safety Record': 8, 'References': 7, 'Capacity': 8})
comparator.score_bid(bid2.bid_id, {'Price': 7, 'Experience': 9, 'Schedule': 7,
                                   'Safety Record': 9, 'References': 9, 'Capacity': 9})

recommendation = comparator.get_recommendation()
print(f"Recommended: {recommendation['recommendation']}")
```

## Resources
- **Jens Book**: Chapter 3.4 - Procurement


---


# Material Procurement Tracker

## Business Case

Long lead items and material procurement require careful tracking to avoid schedule delays.

## Technical Implementation

```python
import pandas as pd
from datetime import date, timedelta
from typing import Dict, Any, List, Optional
from dataclasses import dataclass, field
from enum import Enum


class ProcurementStatus(Enum):
    REQUISITIONED = "requisitioned"
    RFQ_SENT = "rfq_sent"
    QUOTED = "quoted"
    PO_ISSUED = "po_issued"
    IN_PRODUCTION = "in_production"
    SHIPPED = "shipped"
    DELIVERED = "delivered"


class Priority(Enum):
    CRITICAL = "critical"
    HIGH = "high"
    NORMAL = "normal"
    LOW = "low"


@dataclass
class ProcurementItem:
    item_id: str
    description: str
    spec_section: str
    quantity: float
    unit: str
    required_date: date
    lead_time_days: int
    status: ProcurementStatus
    priority: Priority
    vendor: str = ""
    po_number: str = ""
    po_amount: float = 0.0
    order_date: Optional[date] = None
    expected_delivery: Optional[date] = None
    actual_delivery: Optional[date] = None

    @property
    def must_order_by(self) -> date:
        return self.required_date - timedelta(days=self.lead_time_days)

    @property
    def is_late_to_order(self) -> bool:
        if self.status in [ProcurementStatus.PO_ISSUED, ProcurementStatus.IN_PRODUCTION,
                          ProcurementStatus.SHIPPED, ProcurementStatus.DELIVERED]:
            return False
        return date.today() > self.must_order_by


class MaterialProcurementTracker:
    def __init__(self, project_name: str):
        self.project_name = project_name
        self.items: Dict[str, ProcurementItem] = {}
        self._counter = 0

    def add_item(self, description: str, spec_section: str, quantity: float,
                unit: str, required_date: date, lead_time_days: int,
                priority: Priority = Priority.NORMAL) -> ProcurementItem:
        self._counter += 1
        item_id = f"PROC-{self._counter:04d}"

        item = ProcurementItem(
            item_id=item_id,
            description=description,
            spec_section=spec_section,
            quantity=quantity,
            unit=unit,
            required_date=required_date,
            lead_time_days=lead_time_days,
            status=ProcurementStatus.REQUISITIONED,
            priority=priority
        )
        self.items[item_id] = item
        return item

    def issue_po(self, item_id: str, vendor: str, po_number: str,
                amount: float, expected_delivery: date):
        if item_id in self.items:
            item = self.items[item_id]
            item.status = ProcurementStatus.PO_ISSUED
            item.vendor = vendor
            item.po_number = po_number
            item.po_amount = amount
            item.order_date = date.today()
            item.expected_delivery = expected_delivery

    def update_status(self, item_id: str, status: ProcurementStatus):
        if item_id in self.items:
            self.items[item_id].status = status
            if status == ProcurementStatus.DELIVERED:
                self.items[item_id].actual_delivery = date.today()

    def get_items_to_order(self) -> List[ProcurementItem]:
        """Get items that need to be ordered soon."""
        cutoff = date.today() + timedelta(days=14)
        return [i for i in self.items.values()
                if i.status in [ProcurementStatus.REQUISITIONED, ProcurementStatus.RFQ_SENT,
                               ProcurementStatus.QUOTED]
                and i.must_order_by <= cutoff]

    def get_late_items(self) -> List[ProcurementItem]:
        return [i for i in self.items.values() if i.is_late_to_order]

    def get_summary(self) -> Dict[str, Any]:
        by_status = {}
        total_value = 0
        for item in self.items.values():
            status = item.status.value
            by_status[status] = by_status.get(status, 0) + 1
            total_value += item.po_amount

        return {
            'total_items': len(self.items),
            'by_status': by_status,
            'total_po_value': total_value,
            'items_to_order': len(self.get_items_to_order()),
            'late_items': len(self.get_late_items())
        }

    def export_log(self, output_path: str):
        data = [{
            'ID': i.item_id,
            'Description': i.description,
            'Spec': i.spec_section,
            'Qty': i.quantity,
            'Unit': i.unit,
            'Required': i.required_date,
            'Lead Time': i.lead_time_days,
            'Must Order By': i.must_order_by,
            'Status': i.status.value,
            'Vendor': i.vendor,
            'PO': i.po_number,
            'Amount': i.po_amount
        } for i in self.items.values()]
        pd.DataFrame(data).to_excel(output_path, index=False)
```

## Quick Start

```python
tracker = MaterialProcurementTracker("Office Tower")

item = tracker.add_item(
    description="Structural Steel W14x90",
    spec_section="05 12 00",
    quantity=500,
    unit="TON",
    required_date=date(2024, 6, 1),
    lead_time_days=90,
    priority=Priority.CRITICAL
)

tracker.issue_po(item.item_id, "ABC Steel", "PO-2024-001", 450000,
                date(2024, 5, 15))

urgent = tracker.get_items_to_order()
print(f"Items needing order: {len(urgent)}")
```

## Resources
- **Jens Book**: Chapter 3.4 - Procurement


---


# Material Tracker

## Business Case

### Problem Statement
Material management challenges:
- Tracking multiple orders
- Coordinating deliveries
- Avoiding stockouts
- Managing lead times

### Solution
Comprehensive material tracking system to monitor orders, deliveries, inventory, and alert on potential issues.

## Technical Implementation

```python
import pandas as pd
from typing import Dict, Any, List, Optional
from dataclasses import dataclass, field
from datetime import date, timedelta
from enum import Enum


class OrderStatus(Enum):
    DRAFT = "draft"
    SUBMITTED = "submitted"
    CONFIRMED = "confirmed"
    IN_PRODUCTION = "in_production"
    SHIPPED = "shipped"
    DELIVERED = "delivered"
    PARTIAL = "partial"
    CANCELLED = "cancelled"


class PriorityLevel(Enum):
    CRITICAL = "critical"
    HIGH = "high"
    NORMAL = "normal"
    LOW = "low"


@dataclass
class MaterialOrder:
    order_id: str
    material_code: str
    material_name: str
    supplier: str
    quantity: float
    unit: str
    unit_cost: float
    total_cost: float
    order_date: date
    required_date: date
    expected_delivery: date
    actual_delivery: Optional[date]
    status: OrderStatus
    priority: PriorityLevel
    delivered_qty: float = 0
    notes: str = ""


@dataclass
class InventoryItem:
    material_code: str
    material_name: str
    current_stock: float
    unit: str
    min_stock: float
    max_stock: float
    reorder_point: float
    location: str
    last_updated: date


@dataclass
class Delivery:
    delivery_id: str
    order_id: str
    delivery_date: date
    quantity: float
    received_by: str
    condition: str  # good, damaged, partial
    notes: str = ""


class MaterialTracker:
    """Track construction materials."""

    def __init__(self, project_name: str):
        self.project_name = project_name
        self.orders: Dict[str, MaterialOrder] = {}
        self.inventory: Dict[str, InventoryItem] = {}
        self.deliveries: List[Delivery] = []

    def create_order(self,
                     order_id: str,
                     material_code: str,
                     material_name: str,
                     supplier: str,
                     quantity: float,
                     unit: str,
                     unit_cost: float,
                     required_date: date,
                     lead_time_days: int = 14,
                     priority: PriorityLevel = PriorityLevel.NORMAL) -> MaterialOrder:
        """Create new material order."""

        order = MaterialOrder(
            order_id=order_id,
            material_code=material_code,
            material_name=material_name,
            supplier=supplier,
            quantity=quantity,
            unit=unit,
            unit_cost=unit_cost,
            total_cost=round(quantity * unit_cost, 2),
            order_date=date.today(),
            required_date=required_date,
            expected_delivery=date.today() + timedelta(days=lead_time_days),
            actual_delivery=None,
            status=OrderStatus.DRAFT,
            priority=priority
        )

        self.orders[order_id] = order
        return order

    def update_order_status(self, order_id: str, status: OrderStatus):
        """Update order status."""
        if order_id in self.orders:
            self.orders[order_id].status = status

    def record_delivery(self,
                        order_id: str,
                        quantity: float,
                        received_by: str,
                        condition: str = "good",
                        notes: str = "") -> Optional[Delivery]:
        """Record material delivery."""

        if order_id not in self.orders:
            return None

        order = self.orders[order_id]

        delivery = Delivery(
            delivery_id=f"DEL-{len(self.deliveries)+1:04d}",
            order_id=order_id,
            delivery_date=date.today(),
            quantity=quantity,
            received_by=received_by,
            condition=condition,
            notes=notes
        )

        self.deliveries.append(delivery)

        # Update order
        order.delivered_qty += quantity
        order.actual_delivery = date.today()

        if order.delivered_qty >= order.quantity:
            order.status = OrderStatus.DELIVERED
        else:
            order.status = OrderStatus.PARTIAL

        # Update inventory
        if order.material_code in self.inventory:
            self.inventory[order.material_code].current_stock += quantity
            self.inventory[order.material_code].last_updated = date.today()

        return delivery

    def add_inventory_item(self,
                           material_code: str,
                           material_name: str,
                           current_stock: float,
                           unit: str,
                           min_stock: float,
                           max_stock: float,
                           location: str):
        """Add item to inventory tracking."""

        reorder_point = min_stock + (max_stock - min_stock) * 0.3

        self.inventory[material_code] = InventoryItem(
            material_code=material_code,
            material_name=material_name,
            current_stock=current_stock,
            unit=unit,
            min_stock=min_stock,
            max_stock=max_stock,
            reorder_point=reorder_point,
            location=location,
            last_updated=date.today()
        )

    def consume_material(self,
                         material_code: str,
                         quantity: float,
                         activity: str = "") -> bool:
        """Record material consumption."""

        if material_code not in self.inventory:
            return False

        item = self.inventory[material_code]
        if item.current_stock < quantity:
            return False

        item.current_stock -= quantity
        item.last_updated = date.today()
        return True

    def get_pending_orders(self) -> List[MaterialOrder]:
        """Get all pending orders."""
        return [
            o for o in self.orders.values()
            if o.status not in [OrderStatus.DELIVERED, OrderStatus.CANCELLED]
        ]

    def get_late_orders(self) -> List[Dict[str, Any]]:
        """Get orders that are late or at risk."""

        late = []
        today = date.today()

        for order in self.orders.values():
            if order.status in [OrderStatus.DELIVERED, OrderStatus.CANCELLED]:
                continue

            days_late = (today - order.expected_delivery).days

            if days_late > 0 or (order.required_date - today).days < 3:
                late.append({
                    'order_id': order.order_id,
                    'material': order.material_name,
                    'supplier': order.supplier,
                    'required_date': order.required_date,
                    'expected_delivery': order.expected_delivery,
                    'days_late': max(0, days_late),
                    'days_until_required': (order.required_date - today).days,
                    'status': order.status.value,
                    'priority': order.priority.value
                })

        return sorted(late, key=lambda x: x['days_until_required'])

    def get_low_stock_items(self) -> List[Dict[str, Any]]:
        """Get items at or below reorder point."""

        low_stock = []

        for item in self.inventory.values():
            if item.current_stock <= item.reorder_point:
                low_stock.append({
                    'material_code': item.material_code,
                    'material_name': item.material_name,
                    'current_stock': item.current_stock,
                    'reorder_point': item.reorder_point,
                    'min_stock': item.min_stock,
                    'unit': item.unit,
                    'location': item.location,
                    'urgency': 'CRITICAL' if item.current_stock <= item.min_stock else 'REORDER'
                })

        return sorted(low_stock, key=lambda x: x['current_stock'])

    def get_delivery_schedule(self, days_ahead: int = 14) -> pd.DataFrame:
        """Get expected deliveries for coming days."""

        today = date.today()
        end_date = today + timedelta(days=days_ahead)

        scheduled = []

        for order in self.orders.values():
            if order.status in [OrderStatus.DELIVERED, OrderStatus.CANCELLED]:
                continue

            if today <= order.expected_delivery <= end_date:
                scheduled.append({
                    'Date': order.expected_delivery,
                    'Order ID': order.order_id,
                    'Material': order.material_name,
                    'Quantity': order.quantity,
                    'Unit': order.unit,
                    'Supplier': order.supplier,
                    'Priority': order.priority.value
                })

        return pd.DataFrame(scheduled).sort_values('Date') if scheduled else pd.DataFrame()

    def calculate_material_cost_summary(self) -> Dict[str, Any]:
        """Calculate material cost summary."""

        total_ordered = sum(o.total_cost for o in self.orders.values())
        total_delivered = sum(
            o.delivered_qty * o.unit_cost
            for o in self.orders.values()
        )
        total_pending = total_ordered - total_delivered

        by_supplier = {}
        for order in self.orders.values():
            if order.supplier not in by_supplier:
                by_supplier[order.supplier] = 0
            by_supplier[order.supplier] += order.total_cost

        return {
            'total_ordered': round(total_ordered, 2),
            'total_delivered': round(total_delivered, 2),
            'total_pending': round(total_pending, 2),
            'order_count': len(self.orders),
            'by_supplier': by_supplier
        }

    def export_to_excel(self, output_path: str) -> str:
        """Export material tracking to Excel."""

        with pd.ExcelWriter(output_path, engine='openpyxl') as writer:
            # Orders
            orders_df = pd.DataFrame([
                {
                    'Order ID': o.order_id,
                    'Material': o.material_name,
                    'Supplier': o.supplier,
                    'Quantity': o.quantity,
                    'Unit': o.unit,
                    'Unit Cost': o.unit_cost,
                    'Total Cost': o.total_cost,
                    'Order Date': o.order_date,
                    'Required': o.required_date,
                    'Expected': o.expected_delivery,
                    'Status': o.status.value,
                    'Delivered': o.delivered_qty
                }
                for o in self.orders.values()
            ])
            orders_df.to_excel(writer, sheet_name='Orders', index=False)

            # Inventory
            if self.inventory:
                inv_df = pd.DataFrame([
                    {
                        'Code': i.material_code,
                        'Name': i.material_name,
                        'Stock': i.current_stock,
                        'Unit': i.unit,
                        'Min': i.min_stock,
                        'Max': i.max_stock,
                        'Reorder Point': i.reorder_point,
                        'Location': i.location
                    }
                    for i in self.inventory.values()
                ])
                inv_df.to_excel(writer, sheet_name='Inventory', index=False)

            # Late orders
            late = self.get_late_orders()
            if late:
                late_df = pd.DataFrame(late)
                late_df.to_excel(writer, sheet_name='Late Orders', index=False)

            # Low stock
            low = self.get_low_stock_items()
            if low:
                low_df = pd.DataFrame(low)
                low_df.to_excel(writer, sheet_name='Low Stock', index=False)

        return output_path
```

## Quick Start

```python
from datetime import date, timedelta

# Initialize tracker
tracker = MaterialTracker("Office Building A")

# Create order
order = tracker.create_order(
    order_id="PO-001",
    material_code="CONC-C30",
    material_name="Concrete C30",
    supplier="ABC Ready Mix",
    quantity=200,
    unit="m3",
    unit_cost=150,
    required_date=date.today() + timedelta(days=10),
    lead_time_days=3,
    priority=PriorityLevel.HIGH
)

# Update status
tracker.update_order_status("PO-001", OrderStatus.CONFIRMED)

# Record delivery
tracker.record_delivery("PO-001", quantity=200, received_by="John Smith")
```

## Common Use Cases

### 1. Check Late Orders
```python
late = tracker.get_late_orders()
for order in late:
    print(f"{order['order_id']}: {order['days_late']} days late")
```

### 2. Low Stock Alert
```python
low_stock = tracker.get_low_stock_items()
for item in low_stock:
    print(f"{item['material_name']}: {item['current_stock']} {item['unit']} - {item['urgency']}")
```

### 3. Delivery Schedule
```python
schedule = tracker.get_delivery_schedule(days_ahead=7)
print(schedule)
```

## Resources
- **Jens Book**: Chapter 3.2 - Material Management


---


# Subcontractor Prequalification

## Technical Implementation

```python
import pandas as pd
from datetime import date
from typing import Dict, Any, List
from dataclasses import dataclass, field
from enum import Enum


class QualificationStatus(Enum):
    PENDING = "pending"
    QUALIFIED = "qualified"
    CONDITIONALLY_QUALIFIED = "conditionally_qualified"
    NOT_QUALIFIED = "not_qualified"


@dataclass
class PrequalificationCriteria:
    name: str
    weight: float
    min_score: int
    max_score: int = 10


@dataclass
class SubcontractorApplication:
    app_id: str
    company_name: str
    trade: str
    contact_email: str
    years_in_business: int
    annual_revenue: float
    bonding_capacity: float
    emr_rate: float  # Experience Modification Rate
    status: QualificationStatus
    scores: Dict[str, int] = field(default_factory=dict)
    documents_received: List[str] = field(default_factory=list)
    notes: str = ""

    @property
    def total_score(self) -> float:
        return sum(self.scores.values())


class SubcontractorPrequalification:
    def __init__(self, project_name: str):
        self.project_name = project_name
        self.applications: Dict[str, SubcontractorApplication] = {}
        self.criteria = self._default_criteria()
        self._counter = 0

    def _default_criteria(self) -> List[PrequalificationCriteria]:
        return [
            PrequalificationCriteria("Safety Record", 0.25, 6),
            PrequalificationCriteria("Financial Stability", 0.20, 5),
            PrequalificationCriteria("Experience", 0.20, 6),
            PrequalificationCriteria("References", 0.15, 5),
            PrequalificationCriteria("Capacity", 0.10, 5),
            PrequalificationCriteria("Insurance/Bonding", 0.10, 7)
        ]

    def add_application(self, company_name: str, trade: str, contact_email: str,
                       years_in_business: int, annual_revenue: float,
                       bonding_capacity: float, emr_rate: float) -> SubcontractorApplication:
        self._counter += 1
        app_id = f"PQ-{self._counter:03d}"

        app = SubcontractorApplication(
            app_id=app_id,
            company_name=company_name,
            trade=trade,
            contact_email=contact_email,
            years_in_business=years_in_business,
            annual_revenue=annual_revenue,
            bonding_capacity=bonding_capacity,
            emr_rate=emr_rate,
            status=QualificationStatus.PENDING
        )
        self.applications[app_id] = app
        return app

    def score_application(self, app_id: str, scores: Dict[str, int]):
        if app_id not in self.applications:
            return
        app = self.applications[app_id]
        app.scores = scores
        self._evaluate_qualification(app)

    def _evaluate_qualification(self, app: SubcontractorApplication):
        passed = True
        for criteria in self.criteria:
            score = app.scores.get(criteria.name, 0)
            if score < criteria.min_score:
                passed = False
                break

        if passed and app.total_score >= 60:
            app.status = QualificationStatus.QUALIFIED
        elif app.total_score >= 50:
            app.status = QualificationStatus.CONDITIONALLY_QUALIFIED
        else:
            app.status = QualificationStatus.NOT_QUALIFIED

    def get_qualified(self, trade: str = None) -> List[SubcontractorApplication]:
        qualified = [a for a in self.applications.values()
                    if a.status in [QualificationStatus.QUALIFIED,
                                   QualificationStatus.CONDITIONALLY_QUALIFIED]]
        if trade:
            qualified = [a for a in qualified if a.trade.lower() == trade.lower()]
        return qualified

    def export_register(self, output_path: str):
        data = [{
            'ID': a.app_id,
            'Company': a.company_name,
            'Trade': a.trade,
            'Years': a.years_in_business,
            'Revenue': a.annual_revenue,
            'EMR': a.emr_rate,
            'Status': a.status.value,
            'Score': a.total_score
        } for a in self.applications.values()]
        pd.DataFrame(data).to_excel(output_path, index=False)
```

## Quick Start

```python
prequal = SubcontractorPrequalification("Office Tower")

app = prequal.add_application("ABC Electric", "Electrical", "info@abc.com",
                              years_in_business=15, annual_revenue=10000000,
                              bonding_capacity=5000000, emr_rate=0.85)

prequal.score_application(app.app_id, {
    "Safety Record": 8, "Financial Stability": 7, "Experience": 8,
    "References": 7, "Capacity": 8, "Insurance/Bonding": 9
})

qualified = prequal.get_qualified("Electrical")
```

## Resources
- **Jens Book**: Chapter 3.4 - Procurement


---

