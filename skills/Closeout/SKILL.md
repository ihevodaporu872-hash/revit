# Closeout Skills

Consolidated skill reference for Closeout operations.

---

# As-Built Documentation Tracker

## Business Case

### Problem Statement
As-built documentation challenges:
- Tracking hundreds of drawings
- Managing revisions
- Ensuring completeness
- Meeting handover deadlines

### Solution
Systematic tracking of as-built documentation submissions, revisions, and approval status.

## Technical Implementation

```python
import pandas as pd
from typing import Dict, Any, List, Optional
from dataclasses import dataclass, field
from datetime import date, timedelta
from enum import Enum


class DocumentStatus(Enum):
    NOT_STARTED = "not_started"
    IN_PROGRESS = "in_progress"
    SUBMITTED = "submitted"
    UNDER_REVIEW = "under_review"
    APPROVED = "approved"
    REJECTED = "rejected"
    RESUBMIT = "resubmit"


class DocumentType(Enum):
    ARCHITECTURAL = "architectural"
    STRUCTURAL = "structural"
    MECHANICAL = "mechanical"
    ELECTRICAL = "electrical"
    PLUMBING = "plumbing"
    FIRE_PROTECTION = "fire_protection"
    CIVIL = "civil"
    LANDSCAPE = "landscape"
    SPECIFICATIONS = "specifications"
    O_AND_M = "o_and_m"


@dataclass
class AsBuiltDocument:
    document_id: str
    document_number: str
    title: str
    doc_type: DocumentType
    discipline: str
    contractor: str
    status: DocumentStatus
    current_revision: str
    required_date: date
    submitted_date: Optional[date] = None
    approved_date: Optional[date] = None
    reviewer: str = ""
    comments: str = ""
    file_path: str = ""


@dataclass
class DocumentSubmission:
    submission_id: str
    document_id: str
    revision: str
    submission_date: date
    submitted_by: str
    file_path: str
    status: DocumentStatus
    review_comments: str = ""


class AsBuiltTracker:
    """Track as-built documentation."""

    def __init__(self, project_name: str, handover_date: date):
        self.project_name = project_name
        self.handover_date = handover_date
        self.documents: Dict[str, AsBuiltDocument] = {}
        self.submissions: List[DocumentSubmission] = []
        self._next_id = 1

    def add_document(self,
                     document_number: str,
                     title: str,
                     doc_type: DocumentType,
                     discipline: str,
                     contractor: str,
                     required_date: date = None) -> AsBuiltDocument:
        """Add document to tracking."""

        doc_id = f"DOC-{self._next_id:04d}"
        self._next_id += 1

        if required_date is None:
            required_date = self.handover_date - timedelta(days=14)

        doc = AsBuiltDocument(
            document_id=doc_id,
            document_number=document_number,
            title=title,
            doc_type=doc_type,
            discipline=discipline,
            contractor=contractor,
            status=DocumentStatus.NOT_STARTED,
            current_revision="0",
            required_date=required_date
        )

        self.documents[doc_id] = doc
        return doc

    def import_document_list(self, df: pd.DataFrame):
        """Import document list from DataFrame."""

        for _, row in df.iterrows():
            doc_type = DocumentType(row.get('type', 'architectural').lower())
            req_date = pd.to_datetime(row.get('required_date', self.handover_date)).date() if 'required_date' in row else None

            self.add_document(
                document_number=str(row['document_number']),
                title=row['title'],
                doc_type=doc_type,
                discipline=row.get('discipline', ''),
                contractor=row.get('contractor', ''),
                required_date=req_date
            )

    def record_submission(self,
                          document_id: str,
                          revision: str,
                          submitted_by: str,
                          file_path: str = "") -> Optional[DocumentSubmission]:
        """Record document submission."""

        if document_id not in self.documents:
            return None

        doc = self.documents[document_id]

        submission = DocumentSubmission(
            submission_id=f"SUB-{len(self.submissions)+1:04d}",
            document_id=document_id,
            revision=revision,
            submission_date=date.today(),
            submitted_by=submitted_by,
            file_path=file_path,
            status=DocumentStatus.SUBMITTED
        )

        self.submissions.append(submission)

        # Update document
        doc.status = DocumentStatus.SUBMITTED
        doc.current_revision = revision
        doc.submitted_date = date.today()

        return submission

    def review_submission(self,
                          document_id: str,
                          approved: bool,
                          reviewer: str,
                          comments: str = ""):
        """Review submitted document."""

        if document_id not in self.documents:
            return

        doc = self.documents[document_id]

        if approved:
            doc.status = DocumentStatus.APPROVED
            doc.approved_date = date.today()
        else:
            doc.status = DocumentStatus.REJECTED

        doc.reviewer = reviewer
        doc.comments = comments

        # Update latest submission
        for sub in reversed(self.submissions):
            if sub.document_id == document_id:
                sub.status = DocumentStatus.APPROVED if approved else DocumentStatus.REJECTED
                sub.review_comments = comments
                break

    def get_summary(self) -> Dict[str, Any]:
        """Get documentation status summary."""

        docs = list(self.documents.values())
        today = date.today()

        # Status counts
        status_counts = {}
        for status in DocumentStatus:
            status_counts[status.value] = sum(1 for d in docs if d.status == status)

        # By type
        by_type = {}
        for doc_type in DocumentType:
            pending = sum(1 for d in docs if d.doc_type == doc_type and d.status != DocumentStatus.APPROVED)
            if pending > 0:
                by_type[doc_type.value] = pending

        # Overdue
        overdue = sum(
            1 for d in docs
            if d.required_date < today and d.status != DocumentStatus.APPROVED
        )

        # Completion rate
        approved = sum(1 for d in docs if d.status == DocumentStatus.APPROVED)
        completion = (approved / len(docs) * 100) if docs else 0

        return {
            'total_documents': len(docs),
            'approved': approved,
            'completion_rate': round(completion, 1),
            'by_status': status_counts,
            'by_type': by_type,
            'overdue': overdue,
            'days_to_handover': (self.handover_date - today).days
        }

    def get_contractor_status(self, contractor: str) -> Dict[str, Any]:
        """Get status for specific contractor."""

        docs = [d for d in self.documents.values() if d.contractor == contractor]

        approved = sum(1 for d in docs if d.status == DocumentStatus.APPROVED)
        pending = len(docs) - approved

        return {
            'contractor': contractor,
            'total': len(docs),
            'approved': approved,
            'pending': pending,
            'completion_rate': round(approved / len(docs) * 100, 1) if docs else 0
        }

    def get_overdue_documents(self) -> List[Dict[str, Any]]:
        """Get overdue documents."""

        today = date.today()
        overdue = []

        for doc in self.documents.values():
            if doc.required_date < today and doc.status != DocumentStatus.APPROVED:
                overdue.append({
                    'document_id': doc.document_id,
                    'document_number': doc.document_number,
                    'title': doc.title,
                    'contractor': doc.contractor,
                    'required_date': doc.required_date,
                    'days_overdue': (today - doc.required_date).days,
                    'status': doc.status.value
                })

        return sorted(overdue, key=lambda x: x['days_overdue'], reverse=True)

    def forecast_completion(self) -> Dict[str, Any]:
        """Forecast documentation completion."""

        summary = self.get_summary()
        pending = summary['total_documents'] - summary['approved']

        # Calculate submission rate
        recent_approvals = sum(
            1 for d in self.documents.values()
            if d.approved_date and d.approved_date >= date.today() - timedelta(days=14)
        )
        weekly_rate = recent_approvals / 2 if recent_approvals > 0 else 1

        weeks_needed = pending / weekly_rate if weekly_rate > 0 else pending
        projected_completion = date.today() + timedelta(weeks=weeks_needed)

        return {
            'pending_documents': pending,
            'approval_rate_per_week': round(weekly_rate, 1),
            'weeks_needed': round(weeks_needed, 1),
            'projected_completion': projected_completion,
            'handover_date': self.handover_date,
            'on_track': projected_completion <= self.handover_date
        }

    def generate_transmittal(self,
                              document_ids: List[str],
                              to: str,
                              subject: str) -> Dict[str, Any]:
        """Generate transmittal for documents."""

        docs = [self.documents[d] for d in document_ids if d in self.documents]

        return {
            'transmittal_number': f"TR-{date.today().strftime('%Y%m%d')}-001",
            'date': date.today(),
            'from': self.project_name,
            'to': to,
            'subject': subject,
            'documents': [
                {
                    'number': d.document_number,
                    'title': d.title,
                    'revision': d.current_revision
                }
                for d in docs
            ],
            'document_count': len(docs)
        }

    def export_to_excel(self, output_path: str) -> str:
        """Export tracking to Excel."""

        summary = self.get_summary()

        with pd.ExcelWriter(output_path, engine='openpyxl') as writer:
            # Summary
            summary_df = pd.DataFrame([{
                'Project': self.project_name,
                'Handover Date': self.handover_date,
                'Total Documents': summary['total_documents'],
                'Approved': summary['approved'],
                'Completion %': summary['completion_rate'],
                'Overdue': summary['overdue'],
                'Days to Handover': summary['days_to_handover']
            }])
            summary_df.to_excel(writer, sheet_name='Summary', index=False)

            # All Documents
            docs_df = pd.DataFrame([
                {
                    'ID': d.document_id,
                    'Number': d.document_number,
                    'Title': d.title,
                    'Type': d.doc_type.value,
                    'Discipline': d.discipline,
                    'Contractor': d.contractor,
                    'Status': d.status.value,
                    'Revision': d.current_revision,
                    'Required': d.required_date,
                    'Submitted': d.submitted_date,
                    'Approved': d.approved_date
                }
                for d in self.documents.values()
            ])
            docs_df.to_excel(writer, sheet_name='Documents', index=False)

            # Overdue
            overdue = self.get_overdue_documents()
            if overdue:
                overdue_df = pd.DataFrame(overdue)
                overdue_df.to_excel(writer, sheet_name='Overdue', index=False)

            # By Contractor
            contractors = set(d.contractor for d in self.documents.values())
            contractor_data = [self.get_contractor_status(c) for c in contractors]
            if contractor_data:
                contractor_df = pd.DataFrame(contractor_data)
                contractor_df.to_excel(writer, sheet_name='By Contractor', index=False)

        return output_path
```

## Quick Start

```python
from datetime import date, timedelta

# Initialize tracker
tracker = AsBuiltTracker("Office Building A", handover_date=date(2024, 12, 31))

# Add documents
tracker.add_document(
    document_number="A-001",
    title="Floor Plans Level 1-5",
    doc_type=DocumentType.ARCHITECTURAL,
    discipline="Architecture",
    contractor="ABC Architects"
)

tracker.add_document(
    document_number="M-001",
    title="HVAC Layout",
    doc_type=DocumentType.MECHANICAL,
    discipline="HVAC",
    contractor="XYZ MEP"
)

# Record submission
tracker.record_submission("DOC-0001", revision="A", submitted_by="John Smith")

# Review
tracker.review_submission("DOC-0001", approved=True, reviewer="PM", comments="Approved")
```

## Common Use Cases

### 1. Status Summary
```python
summary = tracker.get_summary()
print(f"Completion: {summary['completion_rate']}%")
print(f"Overdue: {summary['overdue']}")
```

### 2. Contractor Report
```python
status = tracker.get_contractor_status("ABC Architects")
print(f"Pending: {status['pending']}")
```

### 3. Forecast
```python
forecast = tracker.forecast_completion()
print(f"On Track: {forecast['on_track']}")
```

## Resources
- **Jens Book**: Chapter 5.1 - Documentation Management


---


# Warranty Tracker

## Business Case

### Problem Statement
Warranty management is often neglected:
- Missing warranty documentation
- Expired warranties untracked
- Difficult to file claims
- Scattered across multiple files

### Solution
Centralized warranty tracking system that monitors expiration dates, stores documentation, and manages claims.

### Business Value
- **Cost savings** - File claims before expiration
- **Organization** - Central warranty repository
- **Compliance** - Meet handover requirements
- **Proactive** - Automatic expiration alerts

## Technical Implementation

```python
import pandas as pd
from datetime import datetime, date, timedelta
from typing import Dict, Any, List, Optional
from dataclasses import dataclass, field
from enum import Enum


class WarrantyType(Enum):
    """Types of warranties."""
    MANUFACTURER = "manufacturer"
    CONTRACTOR = "contractor"
    INSTALLER = "installer"
    EXTENDED = "extended"
    PERFORMANCE = "performance"


class WarrantyStatus(Enum):
    """Warranty status."""
    ACTIVE = "active"
    EXPIRING_SOON = "expiring_soon"  # Within 90 days
    EXPIRED = "expired"
    CLAIMED = "claimed"
    VOID = "void"


class ClaimStatus(Enum):
    """Warranty claim status."""
    DRAFT = "draft"
    SUBMITTED = "submitted"
    UNDER_REVIEW = "under_review"
    APPROVED = "approved"
    DENIED = "denied"
    RESOLVED = "resolved"


class BuildingSystem(Enum):
    """Building systems."""
    STRUCTURAL = "structural"
    ROOFING = "roofing"
    HVAC = "hvac"
    ELECTRICAL = "electrical"
    PLUMBING = "plumbing"
    ELEVATORS = "elevators"
    FIRE_PROTECTION = "fire_protection"
    GLAZING = "glazing"
    FLOORING = "flooring"
    PAINTING = "painting"
    APPLIANCES = "appliances"
    EXTERIOR = "exterior"
    OTHER = "other"


@dataclass
class WarrantyDocument:
    """Warranty document reference."""
    document_id: str
    filename: str
    document_type: str  # certificate, manual, conditions
    upload_date: date
    file_path: str


@dataclass
class Warranty:
    """Warranty record."""
    warranty_id: str
    item_description: str
    system: BuildingSystem
    warranty_type: WarrantyType
    manufacturer: str
    contractor: str
    start_date: date
    end_date: date
    duration_years: int
    coverage_details: str
    exclusions: str
    contact_name: str
    contact_phone: str
    contact_email: str
    location: str
    documents: List[WarrantyDocument] = field(default_factory=list)
    notes: str = ""

    @property
    def status(self) -> WarrantyStatus:
        """Calculate current warranty status."""
        today = date.today()
        if today > self.end_date:
            return WarrantyStatus.EXPIRED
        elif (self.end_date - today).days <= 90:
            return WarrantyStatus.EXPIRING_SOON
        else:
            return WarrantyStatus.ACTIVE

    @property
    def days_remaining(self) -> int:
        """Days until warranty expires."""
        return (self.end_date - date.today()).days

    def to_dict(self) -> Dict[str, Any]:
        return {
            'warranty_id': self.warranty_id,
            'item': self.item_description,
            'system': self.system.value,
            'type': self.warranty_type.value,
            'manufacturer': self.manufacturer,
            'contractor': self.contractor,
            'start_date': self.start_date.isoformat(),
            'end_date': self.end_date.isoformat(),
            'duration_years': self.duration_years,
            'status': self.status.value,
            'days_remaining': self.days_remaining,
            'contact': self.contact_email
        }


@dataclass
class WarrantyClaim:
    """Warranty claim record."""
    claim_id: str
    warranty_id: str
    issue_description: str
    issue_date: date
    reported_date: date
    status: ClaimStatus
    reported_by: str
    resolution: str = ""
    resolution_date: Optional[date] = None
    cost_covered: float = 0.0
    documents: List[str] = field(default_factory=list)
    notes: str = ""


class WarrantyTracker:
    """Track and manage construction warranties."""

    EXPIRING_THRESHOLD_DAYS = 90

    def __init__(self, project_name: str, substantial_completion_date: date):
        self.project_name = project_name
        self.completion_date = substantial_completion_date
        self.warranties: Dict[str, Warranty] = {}
        self.claims: Dict[str, WarrantyClaim] = {}
        self._warranty_counter = 0
        self._claim_counter = 0

    def add_warranty(self,
                    item_description: str,
                    system: BuildingSystem,
                    warranty_type: WarrantyType,
                    manufacturer: str,
                    contractor: str,
                    duration_years: int,
                    coverage_details: str,
                    contact_email: str,
                    start_date: date = None,
                    contact_name: str = "",
                    contact_phone: str = "",
                    exclusions: str = "",
                    location: str = "") -> Warranty:
        """Add new warranty record."""
        self._warranty_counter += 1
        warranty_id = f"WRT-{self._warranty_counter:04d}"

        start = start_date or self.completion_date
        end = start + timedelta(days=duration_years * 365)

        warranty = Warranty(
            warranty_id=warranty_id,
            item_description=item_description,
            system=system,
            warranty_type=warranty_type,
            manufacturer=manufacturer,
            contractor=contractor,
            start_date=start,
            end_date=end,
            duration_years=duration_years,
            coverage_details=coverage_details,
            exclusions=exclusions,
            contact_name=contact_name,
            contact_phone=contact_phone,
            contact_email=contact_email,
            location=location
        )

        self.warranties[warranty_id] = warranty
        return warranty

    def add_document(self, warranty_id: str,
                    filename: str,
                    document_type: str,
                    file_path: str) -> WarrantyDocument:
        """Add document to warranty."""
        if warranty_id not in self.warranties:
            raise ValueError(f"Warranty {warranty_id} not found")

        doc_id = f"{warranty_id}-DOC-{len(self.warranties[warranty_id].documents) + 1:02d}"
        document = WarrantyDocument(
            document_id=doc_id,
            filename=filename,
            document_type=document_type,
            upload_date=date.today(),
            file_path=file_path
        )

        self.warranties[warranty_id].documents.append(document)
        return document

    def file_claim(self,
                  warranty_id: str,
                  issue_description: str,
                  issue_date: date,
                  reported_by: str) -> WarrantyClaim:
        """File warranty claim."""
        if warranty_id not in self.warranties:
            raise ValueError(f"Warranty {warranty_id} not found")

        warranty = self.warranties[warranty_id]

        # Check if warranty is active
        if warranty.status == WarrantyStatus.EXPIRED:
            raise ValueError(f"Warranty {warranty_id} has expired")

        self._claim_counter += 1
        claim_id = f"CLM-{self._claim_counter:04d}"

        claim = WarrantyClaim(
            claim_id=claim_id,
            warranty_id=warranty_id,
            issue_description=issue_description,
            issue_date=issue_date,
            reported_date=date.today(),
            status=ClaimStatus.DRAFT,
            reported_by=reported_by
        )

        self.claims[claim_id] = claim
        return claim

    def update_claim_status(self, claim_id: str,
                           status: ClaimStatus,
                           resolution: str = "",
                           cost_covered: float = 0.0):
        """Update claim status."""
        if claim_id not in self.claims:
            raise ValueError(f"Claim {claim_id} not found")

        claim = self.claims[claim_id]
        claim.status = status

        if resolution:
            claim.resolution = resolution

        if cost_covered > 0:
            claim.cost_covered = cost_covered

        if status in [ClaimStatus.APPROVED, ClaimStatus.DENIED, ClaimStatus.RESOLVED]:
            claim.resolution_date = date.today()

    def get_expiring_warranties(self, days: int = None) -> List[Warranty]:
        """Get warranties expiring within specified days."""
        threshold = days or self.EXPIRING_THRESHOLD_DAYS
        cutoff = date.today() + timedelta(days=threshold)

        return [w for w in self.warranties.values()
                if w.status == WarrantyStatus.ACTIVE and w.end_date <= cutoff]

    def get_active_warranties(self) -> List[Warranty]:
        """Get all active warranties."""
        return [w for w in self.warranties.values()
                if w.status in [WarrantyStatus.ACTIVE, WarrantyStatus.EXPIRING_SOON]]

    def get_warranties_by_system(self, system: BuildingSystem) -> List[Warranty]:
        """Get warranties for specific building system."""
        return [w for w in self.warranties.values() if w.system == system]

    def get_summary(self) -> Dict[str, Any]:
        """Generate warranty summary."""
        by_status = {}
        by_system = {}

        for warranty in self.warranties.values():
            # By status
            status = warranty.status.value
            by_status[status] = by_status.get(status, 0) + 1

            # By system
            system = warranty.system.value
            by_system[system] = by_system.get(system, 0) + 1

        # Claims summary
        open_claims = sum(1 for c in self.claims.values()
                        if c.status not in [ClaimStatus.RESOLVED, ClaimStatus.DENIED])
        total_covered = sum(c.cost_covered for c in self.claims.values()
                          if c.status == ClaimStatus.RESOLVED)

        return {
            'total_warranties': len(self.warranties),
            'by_status': by_status,
            'by_system': by_system,
            'expiring_soon': len(self.get_expiring_warranties()),
            'total_claims': len(self.claims),
            'open_claims': open_claims,
            'total_cost_recovered': total_covered,
            'project': self.project_name,
            'completion_date': self.completion_date.isoformat()
        }

    def generate_expiration_report(self, months_ahead: int = 12) -> pd.DataFrame:
        """Generate warranty expiration report."""
        cutoff = date.today() + timedelta(days=months_ahead * 30)
        upcoming = [w for w in self.warranties.values() if w.end_date <= cutoff]

        data = []
        for w in sorted(upcoming, key=lambda x: x.end_date):
            data.append({
                'Warranty ID': w.warranty_id,
                'Item': w.item_description,
                'System': w.system.value,
                'Manufacturer': w.manufacturer,
                'End Date': w.end_date,
                'Days Remaining': w.days_remaining,
                'Status': w.status.value,
                'Contact': w.contact_email
            })

        return pd.DataFrame(data)

    def export_to_excel(self, output_path: str):
        """Export all warranty data to Excel."""
        with pd.ExcelWriter(output_path, engine='openpyxl') as writer:
            # Warranties
            warranties_df = pd.DataFrame([w.to_dict() for w in self.warranties.values()])
            if not warranties_df.empty:
                warranties_df.to_excel(writer, sheet_name='Warranties', index=False)

            # Claims
            claims_data = []
            for claim in self.claims.values():
                warranty = self.warranties.get(claim.warranty_id)
                claims_data.append({
                    'Claim ID': claim.claim_id,
                    'Warranty ID': claim.warranty_id,
                    'Item': warranty.item_description if warranty else '',
                    'Issue': claim.issue_description,
                    'Issue Date': claim.issue_date,
                    'Status': claim.status.value,
                    'Resolution': claim.resolution,
                    'Cost Covered': claim.cost_covered
                })

            if claims_data:
                pd.DataFrame(claims_data).to_excel(writer, sheet_name='Claims', index=False)

            # Expiring soon
            expiring = self.generate_expiration_report(6)
            if not expiring.empty:
                expiring.to_excel(writer, sheet_name='Expiring Soon', index=False)

        return output_path
```

## Quick Start

```python
from datetime import date

# Initialize tracker
tracker = WarrantyTracker(
    project_name="Office Tower",
    substantial_completion_date=date(2024, 6, 1)
)

# Add warranties
tracker.add_warranty(
    item_description="HVAC System - Rooftop Units",
    system=BuildingSystem.HVAC,
    warranty_type=WarrantyType.MANUFACTURER,
    manufacturer="Carrier",
    contractor="ABC Mechanical",
    duration_years=5,
    coverage_details="Parts and labor for manufacturing defects",
    contact_email="warranty@carrier.com"
)

# Check expiring warranties
expiring = tracker.get_expiring_warranties(90)
print(f"Warranties expiring in 90 days: {len(expiring)}")
```

## Common Use Cases

### 1. Monthly Review
```python
# Get expiration report
report = tracker.generate_expiration_report(months_ahead=3)
print(report[['Item', 'End Date', 'Days Remaining']])
```

### 2. File Claim
```python
claim = tracker.file_claim(
    warranty_id="WRT-0001",
    issue_description="RTU-1 compressor failure",
    issue_date=date.today(),
    reported_by="Building Manager"
)
```

### 3. Export for Handover
```python
tracker.export_to_excel("warranty_register.xlsx")
```

## Resources
- **Jens Book**: Chapter 5 - Project Closeout
- **Reference**: AIA Document G714


---


# Project Closeout Checklist

## Technical Implementation

```python
import pandas as pd
from datetime import date
from typing import Dict, Any, List, Optional
from dataclasses import dataclass, field
from enum import Enum


class ChecklistCategory(Enum):
    DOCUMENTATION = "documentation"
    FINANCIAL = "financial"
    INSPECTIONS = "inspections"
    TRAINING = "training"
    WARRANTIES = "warranties"
    PUNCHLIST = "punchlist"
    TURNOVER = "turnover"


class ItemStatus(Enum):
    NOT_STARTED = "not_started"
    IN_PROGRESS = "in_progress"
    COMPLETE = "complete"
    NOT_APPLICABLE = "not_applicable"


@dataclass
class CloseoutItem:
    item_id: str
    description: str
    category: ChecklistCategory
    responsible_party: str
    due_date: date
    status: ItemStatus
    completed_date: Optional[date] = None
    notes: str = ""
    attachments: List[str] = field(default_factory=list)


class ProjectCloseoutChecklist:
    def __init__(self, project_name: str, substantial_completion: date):
        self.project_name = project_name
        self.substantial_completion = substantial_completion
        self.items: Dict[str, CloseoutItem] = {}
        self._load_standard_items()

    def _load_standard_items(self):
        standard = [
            ("Documentation", ChecklistCategory.DOCUMENTATION, [
                "As-built drawings", "O&M manuals", "Attic stock",
                "Keying schedule", "Equipment list"
            ]),
            ("Financial", ChecklistCategory.FINANCIAL, [
                "Final payment application", "Release of liens",
                "Consent of surety", "Final change orders"
            ]),
            ("Inspections", ChecklistCategory.INSPECTIONS, [
                "Final building inspection", "Fire marshal inspection",
                "Elevator inspection", "Certificate of Occupancy"
            ]),
            ("Training", ChecklistCategory.TRAINING, [
                "HVAC system training", "Fire alarm training",
                "Security system training", "BAS training"
            ]),
            ("Warranties", ChecklistCategory.WARRANTIES, [
                "Roofing warranty", "HVAC warranty", "Elevator warranty",
                "General contractor warranty"
            ])
        ]

        counter = 0
        for category_name, category, items in standard:
            for desc in items:
                counter += 1
                item_id = f"CLO-{counter:03d}"
                self.items[item_id] = CloseoutItem(
                    item_id=item_id,
                    description=desc,
                    category=category,
                    responsible_party="Contractor",
                    due_date=self.substantial_completion,
                    status=ItemStatus.NOT_STARTED
                )

    def add_item(self, description: str, category: ChecklistCategory,
                responsible_party: str, due_date: date) -> CloseoutItem:
        item_id = f"CLO-{len(self.items) + 1:03d}"
        item = CloseoutItem(
            item_id=item_id,
            description=description,
            category=category,
            responsible_party=responsible_party,
            due_date=due_date,
            status=ItemStatus.NOT_STARTED
        )
        self.items[item_id] = item
        return item

    def update_status(self, item_id: str, status: ItemStatus, notes: str = ""):
        if item_id in self.items:
            self.items[item_id].status = status
            if status == ItemStatus.COMPLETE:
                self.items[item_id].completed_date = date.today()
            if notes:
                self.items[item_id].notes = notes

    def get_completion_percentage(self) -> float:
        applicable = [i for i in self.items.values()
                     if i.status != ItemStatus.NOT_APPLICABLE]
        complete = [i for i in applicable if i.status == ItemStatus.COMPLETE]
        return (len(complete) / len(applicable) * 100) if applicable else 0

    def get_outstanding_items(self) -> List[CloseoutItem]:
        return [i for i in self.items.values()
                if i.status in [ItemStatus.NOT_STARTED, ItemStatus.IN_PROGRESS]]

    def get_summary_by_category(self) -> Dict[str, Dict[str, int]]:
        summary = {}
        for item in self.items.values():
            cat = item.category.value
            if cat not in summary:
                summary[cat] = {'total': 0, 'complete': 0, 'outstanding': 0}
            summary[cat]['total'] += 1
            if item.status == ItemStatus.COMPLETE:
                summary[cat]['complete'] += 1
            elif item.status != ItemStatus.NOT_APPLICABLE:
                summary[cat]['outstanding'] += 1
        return summary

    def export_checklist(self, output_path: str):
        data = [{
            'ID': i.item_id,
            'Description': i.description,
            'Category': i.category.value,
            'Responsible': i.responsible_party,
            'Due': i.due_date,
            'Status': i.status.value,
            'Completed': i.completed_date,
            'Notes': i.notes
        } for i in self.items.values()]
        pd.DataFrame(data).to_excel(output_path, index=False)
```

## Quick Start

```python
checklist = ProjectCloseoutChecklist("Office Tower", date(2024, 12, 1))

# Update item status
checklist.update_status("CLO-001", ItemStatus.COMPLETE, "Received from architect")

# Check progress
print(f"Completion: {checklist.get_completion_percentage():.1f}%")

outstanding = checklist.get_outstanding_items()
print(f"Outstanding items: {len(outstanding)}")
```

## Resources
- **Jens Book**: Chapter 5 - Project Closeout


---


# Punch List Manager

## Business Case

### Problem Statement
Project closeout challenges:
- Tracking hundreds of items
- Assigning responsibility
- Monitoring completion
- Documentation for handover

### Solution
Systematic punch list management to track deficiencies, assignments, and completion through project closeout.

## Technical Implementation

```python
import pandas as pd
from typing import Dict, Any, List, Optional
from dataclasses import dataclass, field
from datetime import date, timedelta
from enum import Enum


class PunchItemStatus(Enum):
    OPEN = "open"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    VERIFIED = "verified"
    REJECTED = "rejected"


class PunchItemPriority(Enum):
    CRITICAL = "critical"   # Life safety, code violation
    HIGH = "high"           # Functionality impaired
    MEDIUM = "medium"       # Cosmetic/minor
    LOW = "low"             # Nice to have


class PunchItemCategory(Enum):
    STRUCTURAL = "structural"
    ARCHITECTURAL = "architectural"
    MECHANICAL = "mechanical"
    ELECTRICAL = "electrical"
    PLUMBING = "plumbing"
    FIRE_PROTECTION = "fire_protection"
    EXTERIOR = "exterior"
    SITE = "site"
    GENERAL = "general"


@dataclass
class PunchItem:
    item_id: str
    location: str
    description: str
    category: PunchItemCategory
    priority: PunchItemPriority
    status: PunchItemStatus
    assigned_to: str
    created_date: date
    due_date: date
    completed_date: Optional[date] = None
    verified_date: Optional[date] = None
    verified_by: str = ""
    photos: List[str] = field(default_factory=list)
    notes: str = ""


@dataclass
class PunchListSummary:
    total_items: int
    open_items: int
    in_progress: int
    completed: int
    verified: int
    rejected: int
    completion_rate: float
    by_category: Dict[str, int]
    by_priority: Dict[str, int]
    by_assignee: Dict[str, int]
    overdue_count: int


class PunchListManager:
    """Manage construction punch lists."""

    def __init__(self, project_name: str, target_closeout_date: date):
        self.project_name = project_name
        self.target_date = target_closeout_date
        self.items: Dict[str, PunchItem] = {}
        self._next_id = 1

    def add_item(self,
                 location: str,
                 description: str,
                 category: PunchItemCategory,
                 priority: PunchItemPriority,
                 assigned_to: str,
                 due_date: date = None,
                 notes: str = "") -> PunchItem:
        """Add punch list item."""

        item_id = f"PL-{self._next_id:04d}"
        self._next_id += 1

        if due_date is None:
            # Default based on priority
            if priority == PunchItemPriority.CRITICAL:
                due_date = date.today() + timedelta(days=3)
            elif priority == PunchItemPriority.HIGH:
                due_date = date.today() + timedelta(days=7)
            else:
                due_date = date.today() + timedelta(days=14)

        item = PunchItem(
            item_id=item_id,
            location=location,
            description=description,
            category=category,
            priority=priority,
            status=PunchItemStatus.OPEN,
            assigned_to=assigned_to,
            created_date=date.today(),
            due_date=due_date,
            notes=notes
        )

        self.items[item_id] = item
        return item

    def update_status(self,
                      item_id: str,
                      status: PunchItemStatus,
                      verified_by: str = ""):
        """Update item status."""

        if item_id not in self.items:
            return

        item = self.items[item_id]
        item.status = status

        if status == PunchItemStatus.COMPLETED:
            item.completed_date = date.today()
        elif status == PunchItemStatus.VERIFIED:
            item.verified_date = date.today()
            item.verified_by = verified_by

    def reassign_item(self, item_id: str, new_assignee: str, new_due_date: date = None):
        """Reassign item to different contractor."""

        if item_id not in self.items:
            return

        item = self.items[item_id]
        item.assigned_to = new_assignee

        if new_due_date:
            item.due_date = new_due_date

        item.status = PunchItemStatus.OPEN

    def add_note(self, item_id: str, note: str):
        """Add note to item."""
        if item_id in self.items:
            self.items[item_id].notes += f"\n{date.today()}: {note}"

    def add_photo(self, item_id: str, photo_path: str):
        """Add photo reference to item."""
        if item_id in self.items:
            self.items[item_id].photos.append(photo_path)

    def get_summary(self) -> PunchListSummary:
        """Get punch list summary."""

        items = list(self.items.values())
        today = date.today()

        # Status counts
        open_items = sum(1 for i in items if i.status == PunchItemStatus.OPEN)
        in_progress = sum(1 for i in items if i.status == PunchItemStatus.IN_PROGRESS)
        completed = sum(1 for i in items if i.status == PunchItemStatus.COMPLETED)
        verified = sum(1 for i in items if i.status == PunchItemStatus.VERIFIED)
        rejected = sum(1 for i in items if i.status == PunchItemStatus.REJECTED)

        # Completion rate (verified / total)
        completion_rate = (verified / len(items) * 100) if items else 0

        # By category
        by_category = {}
        for cat in PunchItemCategory:
            count = sum(1 for i in items if i.category == cat and i.status != PunchItemStatus.VERIFIED)
            if count > 0:
                by_category[cat.value] = count

        # By priority
        by_priority = {}
        for pri in PunchItemPriority:
            count = sum(1 for i in items if i.priority == pri and i.status != PunchItemStatus.VERIFIED)
            if count > 0:
                by_priority[pri.value] = count

        # By assignee
        by_assignee = {}
        for item in items:
            if item.status not in [PunchItemStatus.VERIFIED, PunchItemStatus.COMPLETED]:
                if item.assigned_to not in by_assignee:
                    by_assignee[item.assigned_to] = 0
                by_assignee[item.assigned_to] += 1

        # Overdue
        overdue = sum(
            1 for i in items
            if i.due_date < today and i.status not in [PunchItemStatus.VERIFIED, PunchItemStatus.COMPLETED]
        )

        return PunchListSummary(
            total_items=len(items),
            open_items=open_items,
            in_progress=in_progress,
            completed=completed,
            verified=verified,
            rejected=rejected,
            completion_rate=round(completion_rate, 1),
            by_category=by_category,
            by_priority=by_priority,
            by_assignee=by_assignee,
            overdue_count=overdue
        )

    def get_items_by_status(self, status: PunchItemStatus) -> List[PunchItem]:
        """Get items by status."""
        return [i for i in self.items.values() if i.status == status]

    def get_items_by_assignee(self, assignee: str) -> List[PunchItem]:
        """Get items assigned to specific contractor."""
        return [i for i in self.items.values() if i.assigned_to == assignee]

    def get_overdue_items(self) -> List[PunchItem]:
        """Get overdue items."""
        today = date.today()
        return [
            i for i in self.items.values()
            if i.due_date < today and i.status not in [PunchItemStatus.VERIFIED, PunchItemStatus.COMPLETED]
        ]

    def get_critical_items(self) -> List[PunchItem]:
        """Get critical priority items."""
        return [
            i for i in self.items.values()
            if i.priority == PunchItemPriority.CRITICAL
            and i.status not in [PunchItemStatus.VERIFIED]
        ]

    def generate_contractor_report(self, assignee: str) -> pd.DataFrame:
        """Generate report for specific contractor."""

        items = self.get_items_by_assignee(assignee)

        return pd.DataFrame([
            {
                'Item ID': i.item_id,
                'Location': i.location,
                'Description': i.description,
                'Priority': i.priority.value,
                'Status': i.status.value,
                'Due Date': i.due_date,
                'Days Overdue': max(0, (date.today() - i.due_date).days) if i.status != PunchItemStatus.VERIFIED else 0
            }
            for i in items
        ])

    def forecast_completion(self) -> Dict[str, Any]:
        """Forecast closeout completion."""

        summary = self.get_summary()
        remaining = summary.total_items - summary.verified

        if remaining == 0:
            return {
                'status': 'COMPLETE',
                'remaining_items': 0,
                'on_track': True
            }

        # Calculate completion rate (items verified per day)
        verified_items = self.get_items_by_status(PunchItemStatus.VERIFIED)
        if verified_items:
            dates = [i.verified_date for i in verified_items if i.verified_date]
            if dates:
                days_active = (max(dates) - min(dates)).days + 1
                rate = len(dates) / days_active if days_active > 0 else 1
            else:
                rate = 1
        else:
            rate = 1

        days_needed = remaining / rate if rate > 0 else remaining
        projected_completion = date.today() + timedelta(days=int(days_needed))

        return {
            'status': 'IN_PROGRESS',
            'remaining_items': remaining,
            'completion_rate_per_day': round(rate, 1),
            'days_needed': round(days_needed, 0),
            'projected_completion': projected_completion,
            'target_date': self.target_date,
            'on_track': projected_completion <= self.target_date
        }

    def export_to_excel(self, output_path: str) -> str:
        """Export punch list to Excel."""

        with pd.ExcelWriter(output_path, engine='openpyxl') as writer:
            # Summary
            summary = self.get_summary()
            summary_df = pd.DataFrame([{
                'Project': self.project_name,
                'Target Closeout': self.target_date,
                'Total Items': summary.total_items,
                'Open': summary.open_items,
                'In Progress': summary.in_progress,
                'Completed': summary.completed,
                'Verified': summary.verified,
                'Completion %': summary.completion_rate,
                'Overdue': summary.overdue_count
            }])
            summary_df.to_excel(writer, sheet_name='Summary', index=False)

            # All items
            items_df = pd.DataFrame([
                {
                    'Item ID': i.item_id,
                    'Location': i.location,
                    'Description': i.description,
                    'Category': i.category.value,
                    'Priority': i.priority.value,
                    'Status': i.status.value,
                    'Assigned To': i.assigned_to,
                    'Created': i.created_date,
                    'Due': i.due_date,
                    'Completed': i.completed_date,
                    'Verified': i.verified_date,
                    'Notes': i.notes
                }
                for i in self.items.values()
            ])
            items_df.to_excel(writer, sheet_name='All Items', index=False)

            # By Assignee
            assignee_df = pd.DataFrame([
                {'Assignee': k, 'Open Items': v}
                for k, v in summary.by_assignee.items()
            ])
            if not assignee_df.empty:
                assignee_df.to_excel(writer, sheet_name='By Assignee', index=False)

            # Overdue
            overdue = self.get_overdue_items()
            if overdue:
                overdue_df = pd.DataFrame([
                    {
                        'Item ID': i.item_id,
                        'Location': i.location,
                        'Description': i.description,
                        'Assigned To': i.assigned_to,
                        'Due': i.due_date,
                        'Days Overdue': (date.today() - i.due_date).days
                    }
                    for i in overdue
                ])
                overdue_df.to_excel(writer, sheet_name='Overdue', index=False)

        return output_path
```

## Quick Start

```python
from datetime import date, timedelta

# Initialize manager
punch = PunchListManager("Office Building A", target_closeout_date=date(2024, 12, 31))

# Add items
punch.add_item(
    location="Level 3, Room 301",
    description="Ceiling tile damaged",
    category=PunchItemCategory.ARCHITECTURAL,
    priority=PunchItemPriority.MEDIUM,
    assigned_to="ABC Ceilings"
)

punch.add_item(
    location="Lobby",
    description="Fire alarm not functioning",
    category=PunchItemCategory.FIRE_PROTECTION,
    priority=PunchItemPriority.CRITICAL,
    assigned_to="XYZ Fire Protection"
)

# Update status
punch.update_status("PL-0001", PunchItemStatus.COMPLETED)
punch.update_status("PL-0001", PunchItemStatus.VERIFIED, verified_by="John Smith")
```

## Common Use Cases

### 1. Summary Report
```python
summary = punch.get_summary()
print(f"Total: {summary.total_items}")
print(f"Completion: {summary.completion_rate}%")
print(f"Overdue: {summary.overdue_count}")
```

### 2. Contractor Report
```python
report = punch.generate_contractor_report("ABC Ceilings")
print(report)
```

### 3. Forecast Completion
```python
forecast = punch.forecast_completion()
print(f"On Track: {forecast['on_track']}")
print(f"Projected: {forecast['projected_completion']}")
```

## Resources
- **Jens Book**: Chapter 5.1 - Project Closeout


---

