# BIM-Analysis Skills

Consolidated skill reference for BIM-Analysis operations.

---

# BIM Clash Detection

## Business Case

### Problem Statement
Coordination issues cause significant rework:
- MEP vs structural conflicts discovered on site
- Late design changes increase costs
- Manual clash review is time-consuming
- No standardized clash categorization

### Solution
Automated clash detection and analysis system that identifies conflicts between building systems and provides prioritized resolution recommendations.

### Business Value
- **Cost savings** - Detect issues before construction
- **Time reduction** - Automated clash identification
- **Better coordination** - Systematic conflict resolution
- **Quality improvement** - Fewer field issues

## Technical Implementation

```python
import pandas as pd
from datetime import datetime
from typing import Dict, Any, List, Optional, Tuple
from dataclasses import dataclass, field
from enum import Enum
import math


class ClashType(Enum):
    """Types of clashes."""
    HARD = "hard"           # Physical intersection
    SOFT = "soft"           # Clearance violation
    WORKFLOW = "workflow"   # Sequencing conflict
    DUPLICATE = "duplicate" # Duplicated elements


class ClashStatus(Enum):
    """Clash resolution status."""
    NEW = "new"
    ACTIVE = "active"
    RESOLVED = "resolved"
    APPROVED = "approved"
    IGNORED = "ignored"


class ClashSeverity(Enum):
    """Clash severity level."""
    CRITICAL = "critical"
    MAJOR = "major"
    MINOR = "minor"
    INFO = "info"


class Discipline(Enum):
    """BIM disciplines."""
    ARCHITECTURAL = "architectural"
    STRUCTURAL = "structural"
    MECHANICAL = "mechanical"
    ELECTRICAL = "electrical"
    PLUMBING = "plumbing"
    FIRE_PROTECTION = "fire_protection"
    CIVIL = "civil"


@dataclass
class BoundingBox:
    """3D bounding box."""
    min_x: float
    min_y: float
    min_z: float
    max_x: float
    max_y: float
    max_z: float

    def intersects(self, other: 'BoundingBox') -> bool:
        """Check if boxes intersect."""
        return (self.min_x <= other.max_x and self.max_x >= other.min_x and
                self.min_y <= other.max_y and self.max_y >= other.min_y and
                self.min_z <= other.max_z and self.max_z >= other.min_z)

    def volume(self) -> float:
        """Calculate bounding box volume."""
        return ((self.max_x - self.min_x) *
                (self.max_y - self.min_y) *
                (self.max_z - self.min_z))

    def center(self) -> Tuple[float, float, float]:
        """Get center point."""
        return (
            (self.min_x + self.max_x) / 2,
            (self.min_y + self.max_y) / 2,
            (self.min_z + self.max_z) / 2
        )


@dataclass
class BIMElement:
    """BIM element representation."""
    element_id: str
    name: str
    discipline: Discipline
    category: str  # e.g., "Duct", "Beam", "Pipe"
    level: str
    bounding_box: BoundingBox
    properties: Dict[str, Any] = field(default_factory=dict)

    def distance_to(self, other: 'BIMElement') -> float:
        """Calculate distance between element centers."""
        c1 = self.bounding_box.center()
        c2 = other.bounding_box.center()
        return math.sqrt(
            (c2[0] - c1[0])**2 +
            (c2[1] - c1[1])**2 +
            (c2[2] - c1[2])**2
        )


@dataclass
class Clash:
    """Clash between two elements."""
    clash_id: str
    element_a: BIMElement
    element_b: BIMElement
    clash_type: ClashType
    severity: ClashSeverity
    status: ClashStatus
    distance: float  # Penetration depth (negative) or clearance gap
    location: Tuple[float, float, float]
    detected_at: datetime
    resolved_at: Optional[datetime] = None
    assigned_to: Optional[str] = None
    notes: str = ""

    def to_dict(self) -> Dict[str, Any]:
        return {
            'clash_id': self.clash_id,
            'element_a_id': self.element_a.element_id,
            'element_a_name': self.element_a.name,
            'element_a_discipline': self.element_a.discipline.value,
            'element_b_id': self.element_b.element_id,
            'element_b_name': self.element_b.name,
            'element_b_discipline': self.element_b.discipline.value,
            'clash_type': self.clash_type.value,
            'severity': self.severity.value,
            'status': self.status.value,
            'distance': round(self.distance, 3),
            'location_x': self.location[0],
            'location_y': self.location[1],
            'location_z': self.location[2],
            'level': self.element_a.level,
            'detected_at': self.detected_at.isoformat(),
            'assigned_to': self.assigned_to,
            'notes': self.notes
        }


@dataclass
class ClashTest:
    """Clash test configuration."""
    name: str
    discipline_a: Discipline
    discipline_b: Discipline
    clash_type: ClashType
    tolerance: float = 0.0  # Clearance tolerance in meters
    enabled: bool = True


class BIMClashDetector:
    """Detect and manage BIM clashes."""

    def __init__(self):
        self.elements: List[BIMElement] = []
        self.clashes: List[Clash] = []
        self.clash_tests: List[ClashTest] = []
        self._clash_counter = 0

    def load_elements(self, elements_df: pd.DataFrame) -> int:
        """Load BIM elements from DataFrame."""
        loaded = 0
        for _, row in elements_df.iterrows():
            element = BIMElement(
                element_id=str(row.get('element_id', '')),
                name=str(row.get('name', '')),
                discipline=Discipline(row.get('discipline', 'architectural')),
                category=str(row.get('category', '')),
                level=str(row.get('level', '')),
                bounding_box=BoundingBox(
                    min_x=float(row.get('min_x', 0)),
                    min_y=float(row.get('min_y', 0)),
                    min_z=float(row.get('min_z', 0)),
                    max_x=float(row.get('max_x', 0)),
                    max_y=float(row.get('max_y', 0)),
                    max_z=float(row.get('max_z', 0))
                )
            )
            self.elements.append(element)
            loaded += 1
        return loaded

    def add_clash_test(self, test: ClashTest):
        """Add clash test configuration."""
        self.clash_tests.append(test)

    def setup_standard_tests(self):
        """Setup standard MEP coordination tests."""
        standard_tests = [
            ClashTest("MEP vs Structure", Discipline.MECHANICAL, Discipline.STRUCTURAL, ClashType.HARD),
            ClashTest("Electrical vs Structure", Discipline.ELECTRICAL, Discipline.STRUCTURAL, ClashType.HARD),
            ClashTest("Plumbing vs Structure", Discipline.PLUMBING, Discipline.STRUCTURAL, ClashType.HARD),
            ClashTest("MEP vs MEP", Discipline.MECHANICAL, Discipline.ELECTRICAL, ClashType.HARD),
            ClashTest("Duct Clearance", Discipline.MECHANICAL, Discipline.MECHANICAL, ClashType.SOFT, tolerance=0.05),
            ClashTest("Fire Protection", Discipline.FIRE_PROTECTION, Discipline.STRUCTURAL, ClashType.HARD),
        ]
        for test in standard_tests:
            self.add_clash_test(test)

    def run_clash_detection(self) -> List[Clash]:
        """Run all clash tests."""
        new_clashes = []

        for test in self.clash_tests:
            if not test.enabled:
                continue

            # Filter elements by discipline
            elements_a = [e for e in self.elements if e.discipline == test.discipline_a]
            elements_b = [e for e in self.elements if e.discipline == test.discipline_b]

            # Check all pairs
            for elem_a in elements_a:
                for elem_b in elements_b:
                    if elem_a.element_id == elem_b.element_id:
                        continue

                    clash = self._check_clash(elem_a, elem_b, test)
                    if clash:
                        new_clashes.append(clash)

        self.clashes.extend(new_clashes)
        return new_clashes

    def _check_clash(self, elem_a: BIMElement, elem_b: BIMElement,
                     test: ClashTest) -> Optional[Clash]:
        """Check if two elements clash."""

        # Expand bounding box by tolerance for soft clashes
        box_a = elem_a.bounding_box
        box_b = elem_b.bounding_box

        if test.clash_type == ClashType.SOFT:
            # Add clearance tolerance
            expanded_a = BoundingBox(
                box_a.min_x - test.tolerance, box_a.min_y - test.tolerance, box_a.min_z - test.tolerance,
                box_a.max_x + test.tolerance, box_a.max_y + test.tolerance, box_a.max_z + test.tolerance
            )
            intersects = expanded_a.intersects(box_b)
        else:
            intersects = box_a.intersects(box_b)

        if not intersects:
            return None

        # Calculate clash point and severity
        self._clash_counter += 1
        clash_id = f"CLH-{self._clash_counter:05d}"

        # Clash location (center of intersection)
        location = (
            (max(box_a.min_x, box_b.min_x) + min(box_a.max_x, box_b.max_x)) / 2,
            (max(box_a.min_y, box_b.min_y) + min(box_a.max_y, box_b.max_y)) / 2,
            (max(box_a.min_z, box_b.min_z) + min(box_a.max_z, box_b.max_z)) / 2
        )

        # Calculate penetration depth
        distance = elem_a.distance_to(elem_b)

        # Determine severity
        if test.clash_type == ClashType.HARD:
            severity = ClashSeverity.CRITICAL if distance < 0.1 else ClashSeverity.MAJOR
        else:
            severity = ClashSeverity.MINOR if distance > test.tolerance else ClashSeverity.MAJOR

        return Clash(
            clash_id=clash_id,
            element_a=elem_a,
            element_b=elem_b,
            clash_type=test.clash_type,
            severity=severity,
            status=ClashStatus.NEW,
            distance=distance,
            location=location,
            detected_at=datetime.now()
        )

    def get_summary(self) -> Dict[str, Any]:
        """Get clash detection summary."""
        by_severity = {}
        by_discipline = {}
        by_status = {}

        for clash in self.clashes:
            # By severity
            sev = clash.severity.value
            by_severity[sev] = by_severity.get(sev, 0) + 1

            # By discipline pair
            pair = f"{clash.element_a.discipline.value} vs {clash.element_b.discipline.value}"
            by_discipline[pair] = by_discipline.get(pair, 0) + 1

            # By status
            stat = clash.status.value
            by_status[stat] = by_status.get(stat, 0) + 1

        return {
            'total_clashes': len(self.clashes),
            'by_severity': by_severity,
            'by_discipline': by_discipline,
            'by_status': by_status,
            'elements_checked': len(self.elements),
            'tests_run': len([t for t in self.clash_tests if t.enabled])
        }

    def export_to_dataframe(self) -> pd.DataFrame:
        """Export clashes to DataFrame."""
        return pd.DataFrame([c.to_dict() for c in self.clashes])

    def resolve_clash(self, clash_id: str, resolution_note: str):
        """Mark clash as resolved."""
        for clash in self.clashes:
            if clash.clash_id == clash_id:
                clash.status = ClashStatus.RESOLVED
                clash.resolved_at = datetime.now()
                clash.notes = resolution_note
                break

    def assign_clash(self, clash_id: str, assignee: str):
        """Assign clash to team member."""
        for clash in self.clashes:
            if clash.clash_id == clash_id:
                clash.assigned_to = assignee
                clash.status = ClashStatus.ACTIVE
                break
```

## Quick Start

```python
# Initialize detector
detector = BIMClashDetector()

# Setup standard MEP tests
detector.setup_standard_tests()

# Load elements from DataFrame
elements_df = pd.read_excel("bim_elements.xlsx")
detector.load_elements(elements_df)

# Run detection
clashes = detector.run_clash_detection()
print(f"Found {len(clashes)} clashes")

# Get summary
summary = detector.get_summary()
print(f"Critical: {summary['by_severity'].get('critical', 0)}")
```

## Common Use Cases

### 1. MEP Coordination
```python
# Focus on MEP vs Structure
mep_clashes = [c for c in detector.clashes
               if c.element_a.discipline in [Discipline.MECHANICAL, Discipline.ELECTRICAL]]
```

### 2. Export for Review
```python
df = detector.export_to_dataframe()
df.to_excel("clash_report.xlsx", index=False)
```

### 3. Assign to Teams
```python
for clash in detector.clashes:
    if clash.element_a.discipline == Discipline.MECHANICAL:
        detector.assign_clash(clash.clash_id, "MEP Team")
```

## Resources
- **Jens Book**: Chapter 2.4 - BIM Coordination
- **Reference**: ISO 19650 BIM Standards


---


# BIM Classification AI

## Business Case

### Problem Statement
BIM models often lack proper classification:
- Elements without classification codes
- Inconsistent naming conventions
- Manual classification is tedious
- Difficult to map to cost databases

### Solution
AI-powered classification system that analyzes BIM element properties and suggests appropriate classification codes from multiple standards.

### Business Value
- **Automation** - Reduce manual classification effort
- **Consistency** - Standardized classification across projects
- **Integration** - Enable cost estimation and QTO
- **Quality** - Improved data quality in BIM models

## Technical Implementation

```python
import pandas as pd
from typing import Dict, Any, List, Optional, Tuple
from dataclasses import dataclass, field
from enum import Enum
import re


class ClassificationSystem(Enum):
    """Classification standards."""
    UNIFORMAT = "uniformat"
    MASTERFORMAT = "masterformat"
    OMNICLASS = "omniclass"
    UNICLASS = "uniclass"
    CWICR = "cwicr"


@dataclass
class ClassificationCode:
    """Classification code with metadata."""
    code: str
    title: str
    system: ClassificationSystem
    level: int
    parent_code: Optional[str] = None
    keywords: List[str] = field(default_factory=list)


@dataclass
class ClassificationResult:
    """Result of classification attempt."""
    element_id: str
    element_name: str
    element_category: str
    suggested_codes: List[Tuple[ClassificationCode, float]]  # (code, confidence)
    selected_code: Optional[ClassificationCode] = None
    manual_override: bool = False


class ClassificationDatabase:
    """Classification codes database."""

    def __init__(self):
        self.codes: Dict[ClassificationSystem, List[ClassificationCode]] = {
            system: [] for system in ClassificationSystem
        }
        self._load_standard_codes()

    def _load_standard_codes(self):
        """Load standard classification codes."""
        # UniFormat II codes
        uniformat_codes = [
            ("A", "Substructure", 1, None, ["foundation", "basement", "excavation"]),
            ("A10", "Foundations", 2, "A", ["footing", "pile", "foundation"]),
            ("A1010", "Standard Foundations", 3, "A10", ["spread footing", "strip footing"]),
            ("A1020", "Special Foundations", 3, "A10", ["pile", "caisson", "mat foundation"]),
            ("B", "Shell", 1, None, ["superstructure", "exterior", "roof"]),
            ("B10", "Superstructure", 2, "B", ["floor", "roof", "structure"]),
            ("B1010", "Floor Construction", 3, "B10", ["slab", "deck", "floor"]),
            ("B1020", "Roof Construction", 3, "B10", ["roof", "deck", "truss"]),
            ("B20", "Exterior Enclosure", 2, "B", ["wall", "window", "door"]),
            ("B2010", "Exterior Walls", 3, "B20", ["curtain wall", "masonry", "cladding"]),
            ("B2020", "Exterior Windows", 3, "B20", ["window", "glazing", "storefront"]),
            ("B30", "Roofing", 2, "B", ["roof", "membrane", "insulation"]),
            ("C", "Interiors", 1, None, ["partition", "ceiling", "floor finish"]),
            ("C10", "Interior Construction", 2, "C", ["partition", "door", "glazing"]),
            ("C20", "Stairs", 2, "C", ["stair", "railing", "ladder"]),
            ("C30", "Interior Finishes", 2, "C", ["finish", "paint", "flooring"]),
            ("D", "Services", 1, None, ["mechanical", "electrical", "plumbing"]),
            ("D10", "Conveying", 2, "D", ["elevator", "escalator", "lift"]),
            ("D20", "Plumbing", 2, "D", ["pipe", "fixture", "drain"]),
            ("D30", "HVAC", 2, "D", ["duct", "hvac", "air handling"]),
            ("D40", "Fire Protection", 2, "D", ["sprinkler", "fire", "suppression"]),
            ("D50", "Electrical", 2, "D", ["electrical", "power", "lighting"]),
        ]

        for code, title, level, parent, keywords in uniformat_codes:
            self.codes[ClassificationSystem.UNIFORMAT].append(
                ClassificationCode(code, title, ClassificationSystem.UNIFORMAT, level, parent, keywords)
            )

        # MasterFormat codes (simplified)
        masterformat_codes = [
            ("03", "Concrete", 1, None, ["concrete", "formwork", "reinforcing"]),
            ("03 30 00", "Cast-in-Place Concrete", 2, "03", ["concrete", "pour", "slab"]),
            ("03 41 00", "Precast Structural Concrete", 2, "03", ["precast", "concrete", "panel"]),
            ("04", "Masonry", 1, None, ["brick", "block", "stone"]),
            ("05", "Metals", 1, None, ["steel", "metal", "aluminum"]),
            ("05 12 00", "Structural Steel Framing", 2, "05", ["beam", "column", "steel"]),
            ("06", "Wood, Plastics, Composites", 1, None, ["wood", "timber", "lumber"]),
            ("07", "Thermal and Moisture Protection", 1, None, ["insulation", "roofing", "waterproofing"]),
            ("08", "Openings", 1, None, ["door", "window", "glazing"]),
            ("09", "Finishes", 1, None, ["drywall", "paint", "flooring"]),
            ("21", "Fire Suppression", 1, None, ["sprinkler", "fire", "suppression"]),
            ("22", "Plumbing", 1, None, ["pipe", "fixture", "plumbing"]),
            ("23", "HVAC", 1, None, ["hvac", "duct", "mechanical"]),
            ("26", "Electrical", 1, None, ["electrical", "power", "lighting"]),
        ]

        for code, title, level, parent, keywords in masterformat_codes:
            self.codes[ClassificationSystem.MASTERFORMAT].append(
                ClassificationCode(code, title, ClassificationSystem.MASTERFORMAT, level, parent, keywords)
            )

    def search(self, query: str, system: ClassificationSystem = None) -> List[ClassificationCode]:
        """Search classification codes by keyword."""
        results = []
        query_lower = query.lower()

        systems = [system] if system else list(ClassificationSystem)

        for sys in systems:
            for code in self.codes.get(sys, []):
                # Check title
                if query_lower in code.title.lower():
                    results.append(code)
                    continue
                # Check keywords
                if any(query_lower in kw.lower() for kw in code.keywords):
                    results.append(code)

        return results


class BIMClassificationAI:
    """AI-powered BIM element classification."""

    def __init__(self, classification_db: ClassificationDatabase = None):
        self.db = classification_db or ClassificationDatabase()
        self.category_mappings = self._load_category_mappings()
        self.results: List[ClassificationResult] = []

    def _load_category_mappings(self) -> Dict[str, List[str]]:
        """Load Revit/IFC category to classification mappings."""
        return {
            # Structural
            "Structural Columns": ["B10", "05 12 00", "column", "structural"],
            "Structural Framing": ["B10", "05 12 00", "beam", "framing"],
            "Structural Foundations": ["A10", "03 30 00", "foundation", "footing"],
            "Floors": ["B1010", "03 30 00", "floor", "slab"],
            # Architectural
            "Walls": ["B20", "04", "wall", "partition"],
            "Curtain Walls": ["B2010", "08 44 00", "curtain wall", "glazing"],
            "Windows": ["B2020", "08 50 00", "window", "glazing"],
            "Doors": ["C10", "08 10 00", "door", "opening"],
            "Roofs": ["B30", "07 50 00", "roof", "roofing"],
            "Ceilings": ["C30", "09 51 00", "ceiling", "finish"],
            "Stairs": ["C20", "05 51 00", "stair", "railing"],
            # MEP
            "Ducts": ["D30", "23 31 00", "duct", "hvac"],
            "Pipes": ["D20", "22 11 00", "pipe", "plumbing"],
            "Electrical Equipment": ["D50", "26 20 00", "electrical", "panel"],
            "Lighting Fixtures": ["D50", "26 51 00", "light", "fixture"],
            "Sprinklers": ["D40", "21 13 00", "sprinkler", "fire protection"],
            "Mechanical Equipment": ["D30", "23 70 00", "ahu", "hvac equipment"],
        }

    def classify_element(self,
                        element_id: str,
                        element_name: str,
                        category: str,
                        properties: Dict[str, Any] = None,
                        target_systems: List[ClassificationSystem] = None) -> ClassificationResult:
        """Classify a single BIM element."""

        target_systems = target_systems or [ClassificationSystem.UNIFORMAT, ClassificationSystem.MASTERFORMAT]
        suggestions = []

        # Get keywords from category mapping
        keywords = self.category_mappings.get(category, [])

        # Add keywords from element name
        name_words = re.findall(r'\w+', element_name.lower())
        keywords.extend(name_words)

        # Add keywords from properties
        if properties:
            for key, value in properties.items():
                if isinstance(value, str):
                    keywords.extend(re.findall(r'\w+', value.lower()))

        # Search classification codes
        for system in target_systems:
            for keyword in keywords:
                matches = self.db.search(keyword, system)
                for match in matches:
                    confidence = self._calculate_confidence(match, keywords, category)
                    suggestions.append((match, confidence))

        # Remove duplicates and sort by confidence
        seen = set()
        unique_suggestions = []
        for code, conf in sorted(suggestions, key=lambda x: x[1], reverse=True):
            if code.code not in seen:
                seen.add(code.code)
                unique_suggestions.append((code, conf))

        result = ClassificationResult(
            element_id=element_id,
            element_name=element_name,
            element_category=category,
            suggested_codes=unique_suggestions[:5],
            selected_code=unique_suggestions[0][0] if unique_suggestions else None
        )

        self.results.append(result)
        return result

    def _calculate_confidence(self, code: ClassificationCode,
                             keywords: List[str], category: str) -> float:
        """Calculate classification confidence score."""
        score = 0.0

        # Direct category match
        if category in self.category_mappings:
            if code.code in self.category_mappings[category]:
                score += 0.5

        # Keyword matches
        keyword_matches = sum(1 for kw in keywords if kw.lower() in
                            [k.lower() for k in code.keywords])
        score += min(keyword_matches * 0.1, 0.3)

        # Title match
        title_words = code.title.lower().split()
        title_matches = sum(1 for kw in keywords if kw.lower() in title_words)
        score += min(title_matches * 0.1, 0.2)

        return min(score, 1.0)

    def classify_batch(self, elements_df: pd.DataFrame,
                      id_column: str = 'element_id',
                      name_column: str = 'name',
                      category_column: str = 'category') -> pd.DataFrame:
        """Classify multiple elements from DataFrame."""

        results = []
        for _, row in elements_df.iterrows():
            result = self.classify_element(
                element_id=str(row[id_column]),
                element_name=str(row[name_column]),
                category=str(row[category_column]),
                properties=row.to_dict()
            )

            results.append({
                'element_id': result.element_id,
                'element_name': result.element_name,
                'category': result.element_category,
                'uniformat_code': next((c.code for c, _ in result.suggested_codes
                                       if c.system == ClassificationSystem.UNIFORMAT), None),
                'masterformat_code': next((c.code for c, _ in result.suggested_codes
                                          if c.system == ClassificationSystem.MASTERFORMAT), None),
                'confidence': result.suggested_codes[0][1] if result.suggested_codes else 0
            })

        return pd.DataFrame(results)

    def get_summary(self) -> Dict[str, Any]:
        """Get classification summary."""
        total = len(self.results)
        classified = sum(1 for r in self.results if r.selected_code)
        high_confidence = sum(1 for r in self.results
                            if r.suggested_codes and r.suggested_codes[0][1] > 0.7)

        return {
            'total_elements': total,
            'classified': classified,
            'classification_rate': round(classified / total * 100, 1) if total > 0 else 0,
            'high_confidence': high_confidence,
            'high_confidence_rate': round(high_confidence / total * 100, 1) if total > 0 else 0
        }

    def export_results(self) -> pd.DataFrame:
        """Export classification results to DataFrame."""
        data = []
        for result in self.results:
            row = {
                'element_id': result.element_id,
                'element_name': result.element_name,
                'category': result.element_category,
                'selected_code': result.selected_code.code if result.selected_code else None,
                'selected_title': result.selected_code.title if result.selected_code else None,
                'selected_system': result.selected_code.system.value if result.selected_code else None,
                'manual_override': result.manual_override
            }

            # Add top suggestions
            for i, (code, conf) in enumerate(result.suggested_codes[:3]):
                row[f'suggestion_{i+1}_code'] = code.code
                row[f'suggestion_{i+1}_confidence'] = round(conf, 2)

            data.append(row)

        return pd.DataFrame(data)
```

## Quick Start

```python
# Initialize classifier
classifier = BIMClassificationAI()

# Classify single element
result = classifier.classify_element(
    element_id="12345",
    element_name="Concrete Floor Slab Level 2",
    category="Floors",
    properties={'material': 'Concrete', 'thickness': '200mm'}
)

print(f"Suggested: {result.selected_code.code} - {result.selected_code.title}")
print(f"Confidence: {result.suggested_codes[0][1]:.1%}")
```

## Common Use Cases

### 1. Batch Classification
```python
# Load BIM elements
elements = pd.read_excel("bim_elements.xlsx")

# Classify all
classified = classifier.classify_batch(elements)
classified.to_excel("classified_elements.xlsx")
```

### 2. Map to CWICR
```python
# Get UniFormat code for cost mapping
uniformat = result.selected_code.code
cwicr_code = map_uniformat_to_cwicr(uniformat)
```

### 3. Quality Check
```python
summary = classifier.get_summary()
print(f"Classification rate: {summary['classification_rate']}%")
```

## Resources
- **Jens Book**: Chapter 2.5 - Data Standards
- **Reference**: UniFormat II, CSI MasterFormat


---


# BIM Validation Report Generator

## Business Case

### Problem Statement
BIM models often have quality issues:
- Missing required properties
- Invalid or inconsistent data
- Non-compliant with project standards
- Incomplete model information

### Solution
Automated BIM validation system that checks models against configurable rules and generates detailed compliance reports.

### Business Value
- **Quality assurance** - Catch issues early
- **Standards compliance** - Meet project requirements
- **Automation** - Reduce manual QC effort
- **Transparency** - Clear validation results

## Technical Implementation

```python
import pandas as pd
from datetime import datetime
from typing import Dict, Any, List, Optional, Callable
from dataclasses import dataclass, field
from enum import Enum


class ValidationSeverity(Enum):
    """Validation issue severity."""
    ERROR = "error"
    WARNING = "warning"
    INFO = "info"


class ValidationStatus(Enum):
    """Overall validation status."""
    PASSED = "passed"
    PASSED_WITH_WARNINGS = "passed_with_warnings"
    FAILED = "failed"


class RuleCategory(Enum):
    """Validation rule categories."""
    REQUIRED_PROPERTIES = "required_properties"
    DATA_FORMAT = "data_format"
    NAMING_CONVENTION = "naming_convention"
    GEOMETRIC = "geometric"
    CLASSIFICATION = "classification"
    RELATIONSHIPS = "relationships"


@dataclass
class ValidationRule:
    """Single validation rule."""
    rule_id: str
    name: str
    category: RuleCategory
    description: str
    severity: ValidationSeverity
    check_function: Callable
    applicable_categories: List[str] = field(default_factory=list)
    enabled: bool = True


@dataclass
class ValidationIssue:
    """Single validation issue."""
    issue_id: str
    rule_id: str
    rule_name: str
    element_id: str
    element_name: str
    element_category: str
    severity: ValidationSeverity
    message: str
    details: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return {
            'issue_id': self.issue_id,
            'rule_id': self.rule_id,
            'rule_name': self.rule_name,
            'element_id': self.element_id,
            'element_name': self.element_name,
            'element_category': self.element_category,
            'severity': self.severity.value,
            'message': self.message
        }


@dataclass
class ValidationReport:
    """Complete validation report."""
    project_name: str
    model_name: str
    validated_at: datetime
    status: ValidationStatus
    total_elements: int
    elements_with_issues: int
    issues: List[ValidationIssue]
    rules_checked: int
    summary_by_severity: Dict[str, int]
    summary_by_category: Dict[str, int]


class BIMValidationEngine:
    """BIM model validation engine."""

    def __init__(self, project_name: str, model_name: str):
        self.project_name = project_name
        self.model_name = model_name
        self.rules: List[ValidationRule] = []
        self.issues: List[ValidationIssue] = []
        self._issue_counter = 0

        # Load default rules
        self._load_default_rules()

    def _load_default_rules(self):
        """Load standard validation rules."""

        # Required properties rules
        self.add_rule(ValidationRule(
            rule_id="REQ-001",
            name="Element Name Required",
            category=RuleCategory.REQUIRED_PROPERTIES,
            description="All elements must have a name",
            severity=ValidationSeverity.ERROR,
            check_function=lambda e: bool(e.get('name'))
        ))

        self.add_rule(ValidationRule(
            rule_id="REQ-002",
            name="Level Assignment Required",
            category=RuleCategory.REQUIRED_PROPERTIES,
            description="Elements must be assigned to a level",
            severity=ValidationSeverity.WARNING,
            check_function=lambda e: bool(e.get('level')),
            applicable_categories=["Walls", "Floors", "Doors", "Windows"]
        ))

        self.add_rule(ValidationRule(
            rule_id="REQ-003",
            name="Material Required",
            category=RuleCategory.REQUIRED_PROPERTIES,
            description="Structural elements must have material defined",
            severity=ValidationSeverity.ERROR,
            check_function=lambda e: bool(e.get('material')),
            applicable_categories=["Structural Columns", "Structural Framing", "Floors"]
        ))

        # Naming convention rules
        self.add_rule(ValidationRule(
            rule_id="NAM-001",
            name="No Special Characters",
            category=RuleCategory.NAMING_CONVENTION,
            description="Names should not contain special characters",
            severity=ValidationSeverity.WARNING,
            check_function=self._check_no_special_chars
        ))

        self.add_rule(ValidationRule(
            rule_id="NAM-002",
            name="Name Length Check",
            category=RuleCategory.NAMING_CONVENTION,
            description="Names should be between 3 and 100 characters",
            severity=ValidationSeverity.INFO,
            check_function=lambda e: 3 <= len(e.get('name', '')) <= 100
        ))

        # Classification rules
        self.add_rule(ValidationRule(
            rule_id="CLS-001",
            name="Classification Code Present",
            category=RuleCategory.CLASSIFICATION,
            description="Elements should have classification code",
            severity=ValidationSeverity.WARNING,
            check_function=lambda e: bool(e.get('classification_code') or e.get('uniformat'))
        ))

        # Geometric rules
        self.add_rule(ValidationRule(
            rule_id="GEO-001",
            name="Non-Zero Volume",
            category=RuleCategory.GEOMETRIC,
            description="3D elements must have non-zero volume",
            severity=ValidationSeverity.ERROR,
            check_function=lambda e: float(e.get('volume', 0)) > 0,
            applicable_categories=["Walls", "Floors", "Structural Columns", "Structural Framing"]
        ))

        self.add_rule(ValidationRule(
            rule_id="GEO-002",
            name="Valid Bounding Box",
            category=RuleCategory.GEOMETRIC,
            description="Elements must have valid bounding box",
            severity=ValidationSeverity.ERROR,
            check_function=self._check_valid_bbox
        ))

    def _check_no_special_chars(self, element: Dict[str, Any]) -> bool:
        """Check name for special characters."""
        import re
        name = element.get('name', '')
        return bool(re.match(r'^[\w\s\-\.]+$', name))

    def _check_valid_bbox(self, element: Dict[str, Any]) -> bool:
        """Check for valid bounding box."""
        try:
            min_x = float(element.get('min_x', 0))
            max_x = float(element.get('max_x', 0))
            min_y = float(element.get('min_y', 0))
            max_y = float(element.get('max_y', 0))
            min_z = float(element.get('min_z', 0))
            max_z = float(element.get('max_z', 0))
            return max_x > min_x and max_y > min_y and max_z > min_z
        except (ValueError, TypeError):
            return False

    def add_rule(self, rule: ValidationRule):
        """Add validation rule."""
        self.rules.append(rule)

    def add_custom_rule(self, rule_id: str, name: str, category: RuleCategory,
                       check_function: Callable, severity: ValidationSeverity = ValidationSeverity.WARNING,
                       description: str = "", categories: List[str] = None):
        """Add custom validation rule."""
        rule = ValidationRule(
            rule_id=rule_id,
            name=name,
            category=category,
            description=description,
            severity=severity,
            check_function=check_function,
            applicable_categories=categories or []
        )
        self.add_rule(rule)

    def validate_element(self, element: Dict[str, Any]) -> List[ValidationIssue]:
        """Validate single element against all rules."""
        issues = []
        element_category = element.get('category', '')

        for rule in self.rules:
            if not rule.enabled:
                continue

            # Check if rule applies to this category
            if rule.applicable_categories and element_category not in rule.applicable_categories:
                continue

            try:
                passed = rule.check_function(element)
                if not passed:
                    self._issue_counter += 1
                    issue = ValidationIssue(
                        issue_id=f"ISS-{self._issue_counter:05d}",
                        rule_id=rule.rule_id,
                        rule_name=rule.name,
                        element_id=str(element.get('element_id', '')),
                        element_name=str(element.get('name', '')),
                        element_category=element_category,
                        severity=rule.severity,
                        message=rule.description
                    )
                    issues.append(issue)
            except Exception as e:
                # Rule check failed
                self._issue_counter += 1
                issue = ValidationIssue(
                    issue_id=f"ISS-{self._issue_counter:05d}",
                    rule_id=rule.rule_id,
                    rule_name=rule.name,
                    element_id=str(element.get('element_id', '')),
                    element_name=str(element.get('name', '')),
                    element_category=element_category,
                    severity=ValidationSeverity.ERROR,
                    message=f"Rule check error: {str(e)}"
                )
                issues.append(issue)

        return issues

    def validate_model(self, elements_df: pd.DataFrame) -> ValidationReport:
        """Validate entire BIM model."""
        self.issues = []
        elements_with_issues = set()

        for _, row in elements_df.iterrows():
            element = row.to_dict()
            element_issues = self.validate_element(element)

            if element_issues:
                elements_with_issues.add(element.get('element_id'))
                self.issues.extend(element_issues)

        # Calculate summaries
        summary_by_severity = {
            'error': sum(1 for i in self.issues if i.severity == ValidationSeverity.ERROR),
            'warning': sum(1 for i in self.issues if i.severity == ValidationSeverity.WARNING),
            'info': sum(1 for i in self.issues if i.severity == ValidationSeverity.INFO)
        }

        summary_by_category = {}
        for issue in self.issues:
            cat = issue.element_category
            summary_by_category[cat] = summary_by_category.get(cat, 0) + 1

        # Determine overall status
        if summary_by_severity['error'] > 0:
            status = ValidationStatus.FAILED
        elif summary_by_severity['warning'] > 0:
            status = ValidationStatus.PASSED_WITH_WARNINGS
        else:
            status = ValidationStatus.PASSED

        return ValidationReport(
            project_name=self.project_name,
            model_name=self.model_name,
            validated_at=datetime.now(),
            status=status,
            total_elements=len(elements_df),
            elements_with_issues=len(elements_with_issues),
            issues=self.issues,
            rules_checked=len([r for r in self.rules if r.enabled]),
            summary_by_severity=summary_by_severity,
            summary_by_category=summary_by_category
        )

    def export_report(self, report: ValidationReport, output_path: str):
        """Export validation report to Excel."""
        with pd.ExcelWriter(output_path, engine='openpyxl') as writer:
            # Summary sheet
            summary_data = {
                'Metric': ['Project', 'Model', 'Validated At', 'Status',
                          'Total Elements', 'Elements with Issues', 'Rules Checked',
                          'Errors', 'Warnings', 'Info'],
                'Value': [report.project_name, report.model_name,
                         report.validated_at.isoformat(), report.status.value,
                         report.total_elements, report.elements_with_issues,
                         report.rules_checked, report.summary_by_severity['error'],
                         report.summary_by_severity['warning'], report.summary_by_severity['info']]
            }
            pd.DataFrame(summary_data).to_excel(writer, sheet_name='Summary', index=False)

            # Issues sheet
            issues_df = pd.DataFrame([i.to_dict() for i in report.issues])
            if not issues_df.empty:
                issues_df.to_excel(writer, sheet_name='Issues', index=False)

            # By Category sheet
            cat_df = pd.DataFrame([
                {'Category': k, 'Issue Count': v}
                for k, v in report.summary_by_category.items()
            ])
            if not cat_df.empty:
                cat_df.to_excel(writer, sheet_name='By Category', index=False)

        return output_path


def generate_validation_report(elements_df: pd.DataFrame,
                               project_name: str,
                               model_name: str,
                               output_path: str = None) -> ValidationReport:
    """Quick function to generate validation report."""
    engine = BIMValidationEngine(project_name, model_name)
    report = engine.validate_model(elements_df)

    if output_path:
        engine.export_report(report, output_path)

    return report
```

## Quick Start

```python
# Load BIM elements
elements = pd.read_excel("bim_elements.xlsx")

# Run validation
report = generate_validation_report(
    elements,
    project_name="Office Tower",
    model_name="Architectural Model v3.2",
    output_path="validation_report.xlsx"
)

print(f"Status: {report.status.value}")
print(f"Errors: {report.summary_by_severity['error']}")
print(f"Warnings: {report.summary_by_severity['warning']}")
```

## Common Use Cases

### 1. Custom Validation Rules
```python
engine = BIMValidationEngine("Project", "Model")

# Add custom rule
engine.add_custom_rule(
    rule_id="CUSTOM-001",
    name="Fire Rating Required",
    category=RuleCategory.REQUIRED_PROPERTIES,
    check_function=lambda e: bool(e.get('fire_rating')),
    severity=ValidationSeverity.ERROR,
    categories=["Walls", "Doors"]
)
```

### 2. Filter Issues
```python
# Get only errors
errors = [i for i in report.issues if i.severity == ValidationSeverity.ERROR]

# Get issues for specific category
wall_issues = [i for i in report.issues if i.element_category == "Walls"]
```

### 3. Automated QC Pipeline
```python
report = engine.validate_model(elements)
if report.status == ValidationStatus.FAILED:
    send_notification("BIM validation failed", report.summary_by_severity)
```

## Resources
- **Jens Book**: Chapter 4.3 - BIM Validation
- **Reference**: ISO 19650, buildingSMART IDS


---


# IFC Quantity Takeoff Extraction

Extract structured quantity data from BIM models (IFC, Revit) for cost estimation, material ordering, and progress tracking.

## Business Case

**Problem**: Manual quantity takeoff is:
- Time-consuming (40-80 hours for medium project)
- Error-prone (human counting mistakes)
- Not repeatable (changes require full rework)
- Disconnected from design (no live updates)

**Solution**: Automated QTO from BIM that:
- Extracts all quantities in minutes
- Groups by type, level, zone
- Updates instantly with model changes
- Exports to Excel for pricing

**ROI**: 90% reduction in QTO time, near-zero counting errors

## Jens Tools Used

```
┌──────────────────────────────────────────────────────────────────────┐
│                      QTO EXTRACTION PIPELINE                          │
├──────────────────────────────────────────────────────────────────────┤
│                                                                       │
│   INPUT                 CONVERT                 ANALYZE               │
│   ┌─────────┐          ┌─────────┐            ┌─────────┐            │
│   │ .rvt    │          │ Jens     │            │ Python  │            │
│   │ .ifc    │─────────►│Converter│───────────►│ pandas  │            │
│   │ .dwg    │          │         │            │         │            │
│   └─────────┘          └─────────┘            └─────────┘            │
│                              │                      │                 │
│                              ▼                      ▼                 │
│                        ┌─────────┐            ┌─────────┐            │
│                        │ .xlsx   │            │ Grouped │            │
│                        │ raw data│            │ QTO     │            │
│                        └─────────┘            └─────────┘            │
│                                                    │                  │
│   OUTPUT                                           ▼                  │
│   ┌─────────────────────────────────────────────────────────────┐   │
│   │  QTO Report                                                  │   │
│   │  • Element counts by type                                    │   │
│   │  • Areas (m², ft²)                                           │   │
│   │  • Volumes (m³, ft³)                                         │   │
│   │  • Lengths (m, ft)                                           │   │
│   │  • Weights (kg, tons)                                        │   │
│   │  • Grouped by level/zone/system                              │   │
│   └─────────────────────────────────────────────────────────────┘   │
│                                                                       │
└──────────────────────────────────────────────────────────────────────┘
```

## CLI Commands

### Revit to Excel (with BBox for volumes)

```bash
# Basic extraction
RvtExporter.exe "C:\Models\Building.rvt"

# Full extraction with bounding boxes (for volume calculations)
RvtExporter.exe "C:\Models\Building.rvt" complete bbox

# Include schedules (Revit's built-in QTO)
RvtExporter.exe "C:\Models\Building.rvt" complete bbox schedule
```

### IFC to Excel

```bash
# Extract IFC data
IfcExporter.exe "C:\Models\Building.ifc"

# Output: Building.xlsx with all IFC entities
```

### DWG to Excel (2D areas)

```bash
# Extract DWG blocks and areas
DwgExporter.exe "C:\Drawings\FloorPlan.dwg"
```

## Python Implementation

```python
import pandas as pd
import numpy as np
from pathlib import Path
import subprocess
from typing import List, Dict, Optional
from dataclasses import dataclass

@dataclass
class QuantityItem:
    """Single quantity line item"""
    category: str
    type_name: str
    count: int
    area: float = 0.0
    volume: float = 0.0
    length: float = 0.0
    weight: float = 0.0
    unit_area: str = "m²"
    unit_volume: str = "m³"
    unit_length: str = "m"
    level: str = ""
    zone: str = ""


class BIMQuantityExtractor:
    """Extract quantities from BIM models using Jens converters"""

    def __init__(self, converter_path: str):
        self.converter_path = Path(converter_path)

    def convert_model(self, model_path: str, options: List[str] = None) -> Path:
        """Convert BIM model to Excel"""

        model = Path(model_path)
        options = options or ["complete", "bbox"]

        # Determine converter
        ext = model.suffix.lower()
        converters = {
            '.rvt': 'RvtExporter.exe',
            '.rfa': 'RvtExporter.exe',
            '.ifc': 'IfcExporter.exe',
            '.dwg': 'DwgExporter.exe',
            '.dgn': 'DgnExporter.exe'
        }

        converter = self.converter_path / converters.get(ext, 'RvtExporter.exe')

        # Build command
        cmd = [str(converter), str(model)] + options

        # Execute
        result = subprocess.run(cmd, capture_output=True, text=True)

        if result.returncode != 0:
            raise RuntimeError(f"Conversion failed: {result.stderr}")

        # Return path to generated Excel
        xlsx_path = model.with_suffix('.xlsx')
        return xlsx_path

    def load_bim_data(self, xlsx_path: str) -> pd.DataFrame:
        """Load converted BIM data from Excel"""

        xlsx = Path(xlsx_path)
        if not xlsx.exists():
            raise FileNotFoundError(f"Excel file not found: {xlsx}")

        # Read main data sheet
        df = pd.read_excel(xlsx, sheet_name=0)

        # Clean column names
        df.columns = df.columns.str.strip()

        return df

    def extract_quantities(
        self,
        df: pd.DataFrame,
        group_by: str = "Type Name",
        include_categories: List[str] = None
    ) -> List[QuantityItem]:
        """Extract quantities grouped by type"""

        # Filter categories if specified
        if include_categories and 'Category' in df.columns:
            df = df[df['Category'].isin(include_categories)]

        # Group and aggregate
        quantities = []

        for (category, type_name), group in df.groupby(['Category', group_by]):
            item = QuantityItem(
                category=str(category),
                type_name=str(type_name),
                count=len(group)
            )

            # Extract area
            area_cols = ['Area', 'Surface Area', 'Gross Area', 'Net Area']
            for col in area_cols:
                if col in group.columns:
                    item.area = group[col].sum()
                    break

            # Extract volume
            vol_cols = ['Volume', 'Gross Volume', 'Net Volume']
            for col in vol_cols:
                if col in group.columns:
                    item.volume = group[col].sum()
                    break

            # Extract length
            len_cols = ['Length', 'Curve Length', 'Unconnected Height']
            for col in len_cols:
                if col in group.columns:
                    item.length = group[col].sum()
                    break

            # Extract level if available
            if 'Level' in group.columns:
                levels = group['Level'].dropna().unique()
                item.level = ', '.join(str(l) for l in levels)

            quantities.append(item)

        return quantities

    def extract_by_level(
        self,
        df: pd.DataFrame,
        group_by: str = "Type Name"
    ) -> Dict[str, List[QuantityItem]]:
        """Extract quantities grouped by level"""

        result = {}

        if 'Level' not in df.columns:
            result['All Levels'] = self.extract_quantities(df, group_by)
            return result

        for level, level_df in df.groupby('Level'):
            level_name = str(level) if pd.notna(level) else 'Unassigned'
            result[level_name] = self.extract_quantities(level_df, group_by)

        return result

    def calculate_concrete_quantities(self, df: pd.DataFrame) -> dict:
        """Calculate concrete quantities for typical elements"""

        concrete_categories = [
            'Floors', 'Structural Floors',
            'Walls', 'Structural Walls',
            'Structural Foundations', 'Foundation',
            'Structural Columns', 'Columns',
            'Structural Framing', 'Beams'
        ]

        concrete_df = df[df['Category'].isin(concrete_categories)]

        return {
            'total_volume_m3': concrete_df['Volume'].sum() if 'Volume' in concrete_df.columns else 0,
            'by_category': concrete_df.groupby('Category')['Volume'].sum().to_dict() if 'Volume' in concrete_df.columns else {},
            'element_count': len(concrete_df)
        }

    def calculate_wall_quantities(self, df: pd.DataFrame) -> dict:
        """Calculate wall quantities"""

        wall_categories = ['Walls', 'Basic Wall', 'Curtain Wall']
        walls = df[df['Category'].isin(wall_categories)]

        result = {
            'total_area_m2': 0,
            'total_length_m': 0,
            'by_type': {}
        }

        if 'Area' in walls.columns:
            result['total_area_m2'] = walls['Area'].sum()

        if 'Length' in walls.columns:
            result['total_length_m'] = walls['Length'].sum()

        if 'Type Name' in walls.columns:
            for type_name, group in walls.groupby('Type Name'):
                result['by_type'][type_name] = {
                    'count': len(group),
                    'area': group['Area'].sum() if 'Area' in group.columns else 0,
                    'length': group['Length'].sum() if 'Length' in group.columns else 0
                }

        return result

    def generate_qto_report(
        self,
        quantities: List[QuantityItem],
        output_path: str,
        project_name: str = "Project"
    ) -> str:
        """Generate QTO Excel report"""

        # Convert to DataFrame
        records = []
        for q in quantities:
            records.append({
                'Category': q.category,
                'Type': q.type_name,
                'Count': q.count,
                'Area (m²)': round(q.area, 2),
                'Volume (m³)': round(q.volume, 3),
                'Length (m)': round(q.length, 2),
                'Level': q.level
            })

        df = pd.DataFrame(records)

        # Sort by category and type
        df = df.sort_values(['Category', 'Type'])

        # Write to Excel with formatting
        with pd.ExcelWriter(output_path, engine='openpyxl') as writer:
            # Summary sheet
            summary = df.groupby('Category').agg({
                'Count': 'sum',
                'Area (m²)': 'sum',
                'Volume (m³)': 'sum',
                'Length (m)': 'sum'
            }).round(2)
            summary.to_excel(writer, sheet_name='Summary')

            # Detail sheet
            df.to_excel(writer, sheet_name='Detail', index=False)

            # By Level sheet
            if 'Level' in df.columns and df['Level'].notna().any():
                level_summary = df.groupby(['Level', 'Category']).agg({
                    'Count': 'sum',
                    'Area (m²)': 'sum',
                    'Volume (m³)': 'sum'
                }).round(2)
                level_summary.to_excel(writer, sheet_name='By Level')

        return output_path

    def generate_html_report(
        self,
        quantities: List[QuantityItem],
        output_path: str,
        project_name: str = "Project"
    ) -> str:
        """Generate interactive HTML QTO report"""

        # Group by category
        by_category = {}
        for q in quantities:
            if q.category not in by_category:
                by_category[q.category] = []
            by_category[q.category].append(q)

        # Calculate totals
        total_count = sum(q.count for q in quantities)
        total_area = sum(q.area for q in quantities)
        total_volume = sum(q.volume for q in quantities)

        html = f"""
<!DOCTYPE html>
<html>
<head>
    <title>QTO Report - {project_name}</title>
    <style>
        body {{ font-family: Arial, sans-serif; margin: 20px; }}
        .header {{ background: #2c3e50; color: white; padding: 20px; margin-bottom: 20px; }}
        .summary {{ display: flex; gap: 20px; margin-bottom: 20px; }}
        .summary-card {{ background: #ecf0f1; padding: 15px; border-radius: 5px; flex: 1; }}
        .summary-card h3 {{ margin: 0 0 10px 0; color: #7f8c8d; font-size: 14px; }}
        .summary-card .value {{ font-size: 24px; font-weight: bold; color: #2c3e50; }}
        table {{ width: 100%; border-collapse: collapse; margin-bottom: 20px; }}
        th {{ background: #34495e; color: white; padding: 10px; text-align: left; }}
        td {{ padding: 8px; border-bottom: 1px solid #ddd; }}
        tr:hover {{ background: #f5f5f5; }}
        .category-header {{ background: #3498db; color: white; font-weight: bold; }}
        .number {{ text-align: right; }}
    </style>
</head>
<body>
    <div class="header">
        <h1>Quantity Takeoff Report</h1>
        <p>Project: {project_name}</p>
    </div>

    <div class="summary">
        <div class="summary-card">
            <h3>Total Elements</h3>
            <div class="value">{total_count:,}</div>
        </div>
        <div class="summary-card">
            <h3>Total Area</h3>
            <div class="value">{total_area:,.2f} m²</div>
        </div>
        <div class="summary-card">
            <h3>Total Volume</h3>
            <div class="value">{total_volume:,.3f} m³</div>
        </div>
        <div class="summary-card">
            <h3>Categories</h3>
            <div class="value">{len(by_category)}</div>
        </div>
    </div>

    <table>
        <thead>
            <tr>
                <th>Category / Type</th>
                <th class="number">Count</th>
                <th class="number">Area (m²)</th>
                <th class="number">Volume (m³)</th>
                <th class="number">Length (m)</th>
            </tr>
        </thead>
        <tbody>
"""

        for category, items in sorted(by_category.items()):
            cat_count = sum(i.count for i in items)
            cat_area = sum(i.area for i in items)
            cat_volume = sum(i.volume for i in items)

            html += f"""
            <tr class="category-header">
                <td>{category}</td>
                <td class="number">{cat_count:,}</td>
                <td class="number">{cat_area:,.2f}</td>
                <td class="number">{cat_volume:,.3f}</td>
                <td class="number">-</td>
            </tr>
"""
            for item in sorted(items, key=lambda x: x.type_name):
                html += f"""
            <tr>
                <td>&nbsp;&nbsp;&nbsp;{item.type_name}</td>
                <td class="number">{item.count:,}</td>
                <td class="number">{item.area:,.2f}</td>
                <td class="number">{item.volume:,.3f}</td>
                <td class="number">{item.length:,.2f}</td>
            </tr>
"""

        html += """
        </tbody>
    </table>
</body>
</html>
"""

        with open(output_path, 'w', encoding='utf-8') as f:
            f.write(html)

        return output_path


# Usage Example
def extract_qto_from_model(
    model_path: str,
    converter_path: str,
    output_dir: str = None
) -> dict:
    """Complete QTO extraction workflow"""

    from datetime import datetime

    extractor = BIMQuantityExtractor(converter_path)

    # Convert model
    print(f"Converting: {model_path}")
    xlsx_path = extractor.convert_model(model_path, ["complete", "bbox"])

    # Load data
    print(f"Loading data from: {xlsx_path}")
    df = extractor.load_bim_data(xlsx_path)

    # Extract quantities
    quantities = extractor.extract_quantities(df)

    # Generate reports
    output_dir = output_dir or Path(model_path).parent
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")

    excel_path = Path(output_dir) / f"QTO_{timestamp}.xlsx"
    html_path = Path(output_dir) / f"QTO_{timestamp}.html"

    extractor.generate_qto_report(quantities, str(excel_path))
    extractor.generate_html_report(quantities, str(html_path))

    # Calculate specific quantities
    concrete = extractor.calculate_concrete_quantities(df)
    walls = extractor.calculate_wall_quantities(df)

    return {
        'excel_report': str(excel_path),
        'html_report': str(html_path),
        'summary': {
            'total_elements': len(df),
            'categories': df['Category'].nunique() if 'Category' in df.columns else 0,
            'types': df['Type Name'].nunique() if 'Type Name' in df.columns else 0
        },
        'concrete': concrete,
        'walls': walls
    }


if __name__ == "__main__":
    result = extract_qto_from_model(
        model_path=r"C:\Projects\Building.rvt",
        converter_path=r"C:\Jens\Converters",
        output_dir=r"C:\Projects\QTO"
    )

    print(f"Excel: {result['excel_report']}")
    print(f"HTML: {result['html_report']}")
    print(f"Concrete Volume: {result['concrete']['total_volume_m3']:.2f} m³")
```

## n8n Workflow Integration

```yaml
name: BIM QTO Extraction
trigger:
  type: webhook
  path: /qto-extract

steps:
  - convert_model:
      node: Execute Command
      command: |
        "C:\Jens\RvtExporter.exe" "{{$json.model_path}}" complete bbox schedule

  - load_excel:
      node: Spreadsheet File
      operation: read
      file: "={{$json.model_path.replace('.rvt', '.xlsx')}}"

  - group_quantities:
      node: Code
      code: |
        const grouped = {};
        items.forEach(item => {
          const type = item.json['Type Name'];
          if (!grouped[type]) {
            grouped[type] = {
              count: 0,
              area: 0,
              volume: 0
            };
          }
          grouped[type].count++;
          grouped[type].area += parseFloat(item.json['Area'] || 0);
          grouped[type].volume += parseFloat(item.json['Volume'] || 0);
        });
        return Object.entries(grouped).map(([type, data]) => ({
          type,
          ...data
        }));

  - generate_report:
      node: Code
      code: |
        // Generate HTML report
        return generateHTMLReport(items);

  - save_report:
      node: Write Binary File
      path: "={{$json.output_path}}"
```

## Best Practices

1. **Model Quality**: Ensure BIM model has proper levels and types assigned
2. **Units**: Verify model units match expected output units
3. **Categories**: Use consistent category naming for grouping
4. **Updates**: Re-run QTO after design changes
5. **Validation**: Cross-check totals against manual spot checks

## Common Quantity Formulas

```python
# Concrete formwork area (approximate)
formwork_area = concrete_volume * 6  # m² per m³ of concrete

# Rebar quantity (approximate)
rebar_weight = concrete_volume * 100  # kg per m³ (typical)

# Paint area from wall area
paint_area = wall_area * 2  # both sides

# Ceiling area from floor area
ceiling_area = floor_area * 0.95  # typical ratio
```

---

*"Measure twice, cut once. Or better yet, measure automatically from the model."*


---


# Progress Photo Analyzer

## Business Case

### Problem Statement
Site photos are underutilized for progress tracking:
- Manual review is time-consuming
- Subjective progress assessment
- No systematic comparison to plans
- Safety issues may be missed

### Solution
AI-powered photo analysis system that extracts progress information, detects safety concerns, and compares site conditions to BIM models.

### Business Value
- **Automation** - Reduce manual photo review
- **Accuracy** - Objective progress measurement
- **Safety** - Automatic hazard detection
- **Documentation** - Structured photo records

## Technical Implementation

```python
import pandas as pd
from datetime import datetime, date
from typing import Dict, Any, List, Optional, Tuple
from dataclasses import dataclass, field
from enum import Enum
from pathlib import Path
import base64


class PhotoType(Enum):
    """Types of construction photos."""
    PROGRESS = "progress"
    SAFETY = "safety"
    QUALITY = "quality"
    GENERAL = "general"
    DELIVERY = "delivery"


class AnalysisStatus(Enum):
    """Analysis status."""
    PENDING = "pending"
    ANALYZING = "analyzing"
    COMPLETED = "completed"
    FAILED = "failed"


class SafetyIssue(Enum):
    """Detected safety issues."""
    MISSING_PPE = "missing_ppe"
    FALL_HAZARD = "fall_hazard"
    HOUSEKEEPING = "housekeeping"
    SCAFFOLDING = "scaffolding"
    ELECTRICAL = "electrical"
    EXCAVATION = "excavation"
    NONE = "none"


class WorkActivity(Enum):
    """Detected work activities."""
    EXCAVATION = "excavation"
    FOUNDATION = "foundation"
    CONCRETE_POUR = "concrete_pour"
    STEEL_ERECTION = "steel_erection"
    FRAMING = "framing"
    ROOFING = "roofing"
    MEP_ROUGH = "mep_rough"
    DRYWALL = "drywall"
    FINISHES = "finishes"
    EXTERIOR = "exterior"
    UNKNOWN = "unknown"


@dataclass
class PhotoMetadata:
    """Photo metadata."""
    photo_id: str
    filename: str
    capture_date: datetime
    location: str
    level: str
    zone: str
    photo_type: PhotoType
    photographer: str = ""
    gps_coordinates: Optional[Tuple[float, float]] = None
    file_path: str = ""


@dataclass
class ProgressDetection:
    """Detected progress information."""
    work_activity: WorkActivity
    confidence: float
    description: str
    completion_estimate: float  # 0-100%
    elements_visible: List[str] = field(default_factory=list)


@dataclass
class SafetyDetection:
    """Detected safety information."""
    issue_type: SafetyIssue
    confidence: float
    description: str
    severity: str  # low, medium, high
    location_in_image: Optional[Tuple[int, int, int, int]] = None  # bounding box


@dataclass
class PhotoAnalysisResult:
    """Complete photo analysis result."""
    photo_id: str
    metadata: PhotoMetadata
    analysis_date: datetime
    status: AnalysisStatus
    progress_detections: List[ProgressDetection]
    safety_detections: List[SafetyDetection]
    weather_conditions: str
    worker_count: int
    equipment_visible: List[str]
    quality_issues: List[str]
    notes: str = ""
    bim_comparison: Optional[Dict[str, Any]] = None


class ProgressPhotoAnalyzer:
    """Analyze construction site photos."""

    def __init__(self, project_name: str):
        self.project_name = project_name
        self.photos: Dict[str, PhotoMetadata] = {}
        self.results: Dict[str, PhotoAnalysisResult] = {}
        self._photo_counter = 0

    def register_photo(self,
                      filename: str,
                      capture_date: datetime,
                      location: str,
                      level: str = "",
                      zone: str = "",
                      photo_type: PhotoType = PhotoType.PROGRESS,
                      photographer: str = "",
                      file_path: str = "") -> PhotoMetadata:
        """Register a photo for analysis."""
        self._photo_counter += 1
        photo_id = f"PH-{self._photo_counter:05d}"

        metadata = PhotoMetadata(
            photo_id=photo_id,
            filename=filename,
            capture_date=capture_date,
            location=location,
            level=level,
            zone=zone,
            photo_type=photo_type,
            photographer=photographer,
            file_path=file_path
        )

        self.photos[photo_id] = metadata
        return metadata

    def analyze_photo(self, photo_id: str,
                     image_data: bytes = None) -> PhotoAnalysisResult:
        """Analyze a registered photo."""
        if photo_id not in self.photos:
            raise ValueError(f"Photo {photo_id} not registered")

        metadata = self.photos[photo_id]

        # Perform analysis (simulated - would use CV/AI models)
        progress_detections = self._detect_progress(metadata, image_data)
        safety_detections = self._detect_safety(metadata, image_data)
        weather = self._detect_weather(metadata, image_data)
        worker_count = self._count_workers(image_data)
        equipment = self._detect_equipment(image_data)

        result = PhotoAnalysisResult(
            photo_id=photo_id,
            metadata=metadata,
            analysis_date=datetime.now(),
            status=AnalysisStatus.COMPLETED,
            progress_detections=progress_detections,
            safety_detections=safety_detections,
            weather_conditions=weather,
            worker_count=worker_count,
            equipment_visible=equipment,
            quality_issues=[]
        )

        self.results[photo_id] = result
        return result

    def _detect_progress(self, metadata: PhotoMetadata,
                        image_data: bytes = None) -> List[ProgressDetection]:
        """Detect work progress in photo."""
        # Simulated detection based on metadata
        detections = []

        # In real implementation, this would use computer vision
        location_lower = metadata.location.lower()

        if 'foundation' in location_lower or 'basement' in location_lower:
            detections.append(ProgressDetection(
                work_activity=WorkActivity.FOUNDATION,
                confidence=0.85,
                description="Foundation work visible",
                completion_estimate=60.0
            ))
        elif 'steel' in location_lower or 'structure' in location_lower:
            detections.append(ProgressDetection(
                work_activity=WorkActivity.STEEL_ERECTION,
                confidence=0.90,
                description="Structural steel installation",
                completion_estimate=45.0
            ))
        elif 'roof' in location_lower:
            detections.append(ProgressDetection(
                work_activity=WorkActivity.ROOFING,
                confidence=0.80,
                description="Roofing work in progress",
                completion_estimate=30.0
            ))
        else:
            detections.append(ProgressDetection(
                work_activity=WorkActivity.UNKNOWN,
                confidence=0.50,
                description="General construction activity",
                completion_estimate=0.0
            ))

        return detections

    def _detect_safety(self, metadata: PhotoMetadata,
                      image_data: bytes = None) -> List[SafetyDetection]:
        """Detect safety issues in photo."""
        # Simulated detection - real implementation would use AI models
        detections = []

        # In production, this would analyze the actual image
        if metadata.photo_type == PhotoType.SAFETY:
            # Return empty for demonstration
            pass

        return detections

    def _detect_weather(self, metadata: PhotoMetadata,
                       image_data: bytes = None) -> str:
        """Detect weather conditions from photo."""
        # Simulated - would use image analysis
        return "clear"

    def _count_workers(self, image_data: bytes = None) -> int:
        """Count workers visible in photo."""
        # Simulated - would use person detection
        return 0

    def _detect_equipment(self, image_data: bytes = None) -> List[str]:
        """Detect equipment visible in photo."""
        # Simulated - would use object detection
        return []

    def compare_to_bim(self, photo_id: str,
                      bim_render: bytes = None) -> Dict[str, Any]:
        """Compare photo to BIM model render."""
        if photo_id not in self.results:
            return {'error': 'Photo not analyzed'}

        # Simulated comparison
        comparison = {
            'similarity_score': 0.75,
            'alignment_quality': 'good',
            'discrepancies': [],
            'notes': 'Photo roughly matches BIM model'
        }

        self.results[photo_id].bim_comparison = comparison
        return comparison

    def get_progress_summary(self,
                            from_date: date = None,
                            to_date: date = None) -> Dict[str, Any]:
        """Generate progress summary from analyzed photos."""
        filtered_results = list(self.results.values())

        if from_date:
            filtered_results = [r for r in filtered_results
                              if r.metadata.capture_date.date() >= from_date]
        if to_date:
            filtered_results = [r for r in filtered_results
                              if r.metadata.capture_date.date() <= to_date]

        # Aggregate by activity
        by_activity = {}
        for result in filtered_results:
            for detection in result.progress_detections:
                activity = detection.work_activity.value
                if activity not in by_activity:
                    by_activity[activity] = {
                        'count': 0,
                        'avg_completion': 0,
                        'photos': []
                    }
                by_activity[activity]['count'] += 1
                by_activity[activity]['avg_completion'] += detection.completion_estimate
                by_activity[activity]['photos'].append(result.photo_id)

        # Calculate averages
        for activity in by_activity:
            count = by_activity[activity]['count']
            if count > 0:
                by_activity[activity]['avg_completion'] /= count

        # Safety summary
        total_safety_issues = sum(len(r.safety_detections) for r in filtered_results)

        return {
            'total_photos': len(filtered_results),
            'date_range': {
                'from': from_date.isoformat() if from_date else None,
                'to': to_date.isoformat() if to_date else None
            },
            'by_activity': by_activity,
            'safety_issues_detected': total_safety_issues,
            'average_worker_count': sum(r.worker_count for r in filtered_results) / len(filtered_results) if filtered_results else 0
        }

    def export_report(self, output_path: str):
        """Export analysis results to Excel."""
        with pd.ExcelWriter(output_path, engine='openpyxl') as writer:
            # Photos list
            photos_data = []
            for result in self.results.values():
                photos_data.append({
                    'Photo ID': result.photo_id,
                    'Filename': result.metadata.filename,
                    'Date': result.metadata.capture_date,
                    'Location': result.metadata.location,
                    'Level': result.metadata.level,
                    'Type': result.metadata.photo_type.value,
                    'Status': result.status.value,
                    'Worker Count': result.worker_count,
                    'Weather': result.weather_conditions
                })

            pd.DataFrame(photos_data).to_excel(writer, sheet_name='Photos', index=False)

            # Progress detections
            progress_data = []
            for result in self.results.values():
                for detection in result.progress_detections:
                    progress_data.append({
                        'Photo ID': result.photo_id,
                        'Activity': detection.work_activity.value,
                        'Confidence': detection.confidence,
                        'Completion %': detection.completion_estimate,
                        'Description': detection.description
                    })

            if progress_data:
                pd.DataFrame(progress_data).to_excel(writer, sheet_name='Progress', index=False)

            # Safety detections
            safety_data = []
            for result in self.results.values():
                for detection in result.safety_detections:
                    safety_data.append({
                        'Photo ID': result.photo_id,
                        'Issue': detection.issue_type.value,
                        'Severity': detection.severity,
                        'Confidence': detection.confidence,
                        'Description': detection.description
                    })

            if safety_data:
                pd.DataFrame(safety_data).to_excel(writer, sheet_name='Safety', index=False)

        return output_path


def analyze_site_photos(photo_files: List[str],
                       project_name: str,
                       output_path: str = None) -> Dict[str, Any]:
    """Quick function to analyze multiple photos."""
    analyzer = ProgressPhotoAnalyzer(project_name)

    for file_path in photo_files:
        path = Path(file_path)
        metadata = analyzer.register_photo(
            filename=path.name,
            capture_date=datetime.now(),
            location="Site",
            photo_type=PhotoType.PROGRESS,
            file_path=file_path
        )
        analyzer.analyze_photo(metadata.photo_id)

    summary = analyzer.get_progress_summary()

    if output_path:
        analyzer.export_report(output_path)

    return summary
```

## Quick Start

```python
# Initialize analyzer
analyzer = ProgressPhotoAnalyzer("Office Tower Project")

# Register and analyze photos
metadata = analyzer.register_photo(
    filename="site_photo_001.jpg",
    capture_date=datetime.now(),
    location="Level 3 - Core",
    level="Level 3",
    zone="Zone A",
    photo_type=PhotoType.PROGRESS,
    photographer="John Smith"
)

result = analyzer.analyze_photo(metadata.photo_id)
print(f"Detected activity: {result.progress_detections[0].work_activity.value}")
print(f"Completion estimate: {result.progress_detections[0].completion_estimate}%")
```

## Common Use Cases

### 1. Daily Progress Report
```python
from datetime import date

summary = analyzer.get_progress_summary(
    from_date=date.today(),
    to_date=date.today()
)
print(f"Photos analyzed today: {summary['total_photos']}")
```

### 2. Safety Monitoring
```python
safety_photos = [r for r in analyzer.results.values() if r.safety_detections]
for result in safety_photos:
    for issue in result.safety_detections:
        print(f"Safety issue: {issue.issue_type.value} - {issue.severity}")
```

### 3. Export Analysis
```python
analyzer.export_report("photo_analysis_report.xlsx")
```

## Resources
- **Jens Book**: Chapter 4.1 - Site Data Collection
- **Reference**: Computer Vision for Construction


---

