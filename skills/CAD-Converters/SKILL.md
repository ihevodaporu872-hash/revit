# CAD-Converters Skills

Consolidated skill reference for CAD-Converters operations.

---

# Batch CAD/BIM Converter

## Business Case

### Problem Statement
Large projects and archives contain hundreds or thousands of CAD/BIM files:
- Manual conversion is tedious and error-prone
- Different formats require different converters
- Progress tracking is needed for long operations
- Error handling is critical for large batches

### Solution
Unified batch converter handling all supported formats with progress tracking, error recovery, and consolidated reporting.

### Business Value
- **Multi-format** - Revit, IFC, DWG, DGN in one workflow
- **Error recovery** - Continue on failures
- **Progress tracking** - Monitor large batches
- **Reporting** - Consolidated conversion results

## Python Implementation

```python
import subprocess
from pathlib import Path
from typing import List, Optional, Dict, Any, Callable
from dataclasses import dataclass, field
from datetime import datetime
import time
import json
from enum import Enum
from concurrent.futures import ThreadPoolExecutor, as_completed


class CADFormat(Enum):
    """Supported CAD/BIM formats."""
    REVIT = (".rvt", ".rfa")
    IFC = (".ifc",)
    DWG = (".dwg",)
    DGN = (".dgn",)


class ConversionStatus(Enum):
    """Status of conversion operation."""
    PENDING = "pending"
    CONVERTING = "converting"
    SUCCESS = "success"
    FAILED = "failed"
    SKIPPED = "skipped"


@dataclass
class ConversionResult:
    """Result of single file conversion."""
    input_file: str
    output_file: Optional[str]
    format: str
    status: ConversionStatus
    start_time: datetime
    end_time: Optional[datetime]
    duration_seconds: float
    error_message: Optional[str] = None
    file_size_kb: float = 0


@dataclass
class BatchResult:
    """Result of batch conversion."""
    total_files: int
    successful: int
    failed: int
    skipped: int
    total_duration: float
    results: List[ConversionResult]
    start_time: datetime
    end_time: datetime


class BatchCADConverter:
    """Batch convert multiple CAD/BIM files."""

    # Default converter paths
    DEFAULT_CONVERTERS = {
        'revit': 'RvtExporter.exe',
        'ifc': 'IfcExporter.exe',
        'dwg': 'DwgExporter.exe',
        'dgn': 'DgnExporter.exe'
    }

    def __init__(self, converter_dir: str = ".",
                 converters: Dict[str, str] = None):
        self.converter_dir = Path(converter_dir)
        self.converters = converters or self.DEFAULT_CONVERTERS
        self.results: List[ConversionResult] = []
        self.progress_callback: Optional[Callable] = None

    def set_progress_callback(self, callback: Callable[[int, int, str], None]):
        """Set callback for progress updates."""
        self.progress_callback = callback

    def _get_format(self, file_path: Path) -> Optional[str]:
        """Detect CAD format from extension."""
        ext = file_path.suffix.lower()

        for format_name, extensions in [
            ('revit', ('.rvt', '.rfa')),
            ('ifc', ('.ifc',)),
            ('dwg', ('.dwg',)),
            ('dgn', ('.dgn',))
        ]:
            if ext in extensions:
                return format_name

        return None

    def _get_converter(self, format_name: str) -> Optional[Path]:
        """Get converter path for format."""
        if format_name not in self.converters:
            return None

        converter = self.converter_dir / self.converters[format_name]
        if converter.exists():
            return converter

        # Try in system PATH
        return Path(self.converters[format_name])

    def convert_file(self, input_file: str,
                     output_dir: Optional[str] = None,
                     options: List[str] = None) -> ConversionResult:
        """Convert single file."""

        input_path = Path(input_file)
        start_time = datetime.now()

        # Detect format
        format_name = self._get_format(input_path)
        if not format_name:
            return ConversionResult(
                input_file=input_file,
                output_file=None,
                format='unknown',
                status=ConversionStatus.SKIPPED,
                start_time=start_time,
                end_time=datetime.now(),
                duration_seconds=0,
                error_message="Unsupported format"
            )

        # Get converter
        converter = self._get_converter(format_name)
        if not converter:
            return ConversionResult(
                input_file=input_file,
                output_file=None,
                format=format_name,
                status=ConversionStatus.FAILED,
                start_time=start_time,
                end_time=datetime.now(),
                duration_seconds=0,
                error_message=f"Converter not found for {format_name}"
            )

        # Build command
        cmd = [str(converter), str(input_path)]
        if options:
            cmd.extend(options)

        # Execute
        try:
            result = subprocess.run(cmd, capture_output=True, text=True, timeout=3600)
            end_time = datetime.now()
            duration = (end_time - start_time).total_seconds()

            # Determine output file
            output_file = input_path.with_suffix('.xlsx')
            if output_dir:
                output_file = Path(output_dir) / output_file.name

            if result.returncode == 0 and output_file.exists():
                return ConversionResult(
                    input_file=input_file,
                    output_file=str(output_file),
                    format=format_name,
                    status=ConversionStatus.SUCCESS,
                    start_time=start_time,
                    end_time=end_time,
                    duration_seconds=duration,
                    file_size_kb=output_file.stat().st_size / 1024
                )
            else:
                return ConversionResult(
                    input_file=input_file,
                    output_file=None,
                    format=format_name,
                    status=ConversionStatus.FAILED,
                    start_time=start_time,
                    end_time=end_time,
                    duration_seconds=duration,
                    error_message=result.stderr or "Conversion failed"
                )

        except subprocess.TimeoutExpired:
            return ConversionResult(
                input_file=input_file,
                output_file=None,
                format=format_name,
                status=ConversionStatus.FAILED,
                start_time=start_time,
                end_time=datetime.now(),
                duration_seconds=3600,
                error_message="Timeout exceeded (1 hour)"
            )

        except Exception as e:
            return ConversionResult(
                input_file=input_file,
                output_file=None,
                format=format_name,
                status=ConversionStatus.FAILED,
                start_time=start_time,
                end_time=datetime.now(),
                duration_seconds=0,
                error_message=str(e)
            )

    def batch_convert(self, input_folder: str,
                      output_folder: Optional[str] = None,
                      include_subfolders: bool = True,
                      formats: List[str] = None,
                      options: Dict[str, List[str]] = None,
                      parallel: bool = False,
                      max_workers: int = 4) -> BatchResult:
        """Convert all files in folder."""

        start_time = datetime.now()
        input_path = Path(input_folder)

        # Find all supported files
        files = []
        pattern = "**/*" if include_subfolders else "*"

        for ext in ['.rvt', '.rfa', '.ifc', '.dwg', '.dgn']:
            files.extend(input_path.glob(f"{pattern}{ext}"))

        # Filter by format if specified
        if formats:
            files = [f for f in files if self._get_format(f) in formats]

        total_files = len(files)
        self.results = []

        # Create output directory
        if output_folder:
            Path(output_folder).mkdir(parents=True, exist_ok=True)

        # Process files
        if parallel and total_files > 1:
            self._convert_parallel(files, output_folder, options, max_workers)
        else:
            self._convert_sequential(files, output_folder, options)

        end_time = datetime.now()

        # Calculate statistics
        successful = sum(1 for r in self.results if r.status == ConversionStatus.SUCCESS)
        failed = sum(1 for r in self.results if r.status == ConversionStatus.FAILED)
        skipped = sum(1 for r in self.results if r.status == ConversionStatus.SKIPPED)

        return BatchResult(
            total_files=total_files,
            successful=successful,
            failed=failed,
            skipped=skipped,
            total_duration=(end_time - start_time).total_seconds(),
            results=self.results,
            start_time=start_time,
            end_time=end_time
        )

    def _convert_sequential(self, files: List[Path],
                            output_folder: Optional[str],
                            options: Dict[str, List[str]]):
        """Convert files sequentially."""

        total = len(files)
        for i, file_path in enumerate(files, 1):
            if self.progress_callback:
                self.progress_callback(i, total, str(file_path))

            format_name = self._get_format(file_path)
            format_options = options.get(format_name, []) if options else []

            result = self.convert_file(str(file_path), output_folder, format_options)
            self.results.append(result)

            status_symbol = "✓" if result.status == ConversionStatus.SUCCESS else "✗"
            print(f"[{i}/{total}] {status_symbol} {file_path.name}")

    def _convert_parallel(self, files: List[Path],
                          output_folder: Optional[str],
                          options: Dict[str, List[str]],
                          max_workers: int):
        """Convert files in parallel."""

        total = len(files)

        with ThreadPoolExecutor(max_workers=max_workers) as executor:
            futures = {}

            for file_path in files:
                format_name = self._get_format(file_path)
                format_options = options.get(format_name, []) if options else []
                future = executor.submit(self.convert_file, str(file_path), output_folder, format_options)
                futures[future] = file_path

            completed = 0
            for future in as_completed(futures):
                completed += 1
                result = future.result()
                self.results.append(result)

                if self.progress_callback:
                    self.progress_callback(completed, total, str(futures[future]))

    def generate_report(self, batch_result: BatchResult,
                        output_path: str = None) -> str:
        """Generate conversion report."""

        report = {
            'summary': {
                'total_files': batch_result.total_files,
                'successful': batch_result.successful,
                'failed': batch_result.failed,
                'skipped': batch_result.skipped,
                'success_rate': round(batch_result.successful / batch_result.total_files * 100, 1) if batch_result.total_files > 0 else 0,
                'total_duration_seconds': round(batch_result.total_duration, 2),
                'start_time': batch_result.start_time.isoformat(),
                'end_time': batch_result.end_time.isoformat()
            },
            'results': [
                {
                    'input': r.input_file,
                    'output': r.output_file,
                    'format': r.format,
                    'status': r.status.value,
                    'duration': round(r.duration_seconds, 2),
                    'error': r.error_message
                }
                for r in batch_result.results
            ]
        }

        report_json = json.dumps(report, indent=2)

        if output_path:
            with open(output_path, 'w') as f:
                f.write(report_json)

        return report_json


# Progress callback example
def print_progress(current: int, total: int, file_name: str):
    """Print progress to console."""
    percent = current / total * 100
    print(f"Progress: {current}/{total} ({percent:.1f}%) - {file_name}")
```

## Quick Start

```python
# Initialize batch converter
converter = BatchCADConverter(converter_dir="C:/Jens/")

# Set progress callback
converter.set_progress_callback(print_progress)

# Convert all files
result = converter.batch_convert(
    input_folder="C:/Projects",
    output_folder="C:/Converted",
    include_subfolders=True
)

print(f"Success: {result.successful}/{result.total_files}")
```

## Common Use Cases

### 1. Convert Specific Formats Only
```python
result = converter.batch_convert(
    input_folder="C:/Archive",
    formats=['revit', 'ifc'],  # Only Revit and IFC
    parallel=True,
    max_workers=4
)
```

### 2. With Format-Specific Options
```python
options = {
    'revit': ['complete', 'bbox', 'rooms'],
    'ifc': ['bbox'],
    'dwg': []
}
result = converter.batch_convert(
    input_folder="C:/Projects",
    options=options
)
```

### 3. Generate Report
```python
result = converter.batch_convert("C:/Projects")
report = converter.generate_report(result, "conversion_report.json")
```

## Resources
- **GitHub**: [cad2data Pipeline](https://github.com/jens-construction/cad2data-Revit-IFC-DWG-DGN-pipeline-with-conversion-validation-qto)


---


# DGN to Excel Conversion

## Business Case

### Problem Statement
DGN files are common in infrastructure and civil engineering:
- Transportation and highway design
- Bridge and tunnel projects
- Utility networks
- Rail infrastructure

Extracting structured data from DGN files for analysis and reporting can be challenging.

### Solution
Convert DGN files to structured Excel databases, supporting both v7 and v8 formats.

### Business Value
- **Infrastructure support** - Civil engineering focused
- **Legacy format support** - V7 and V8 DGN files
- **Data extraction** - Levels, cells, text, geometry
- **Batch processing** - Process multiple files
- **Structured output** - Excel format for analysis

## Technical Implementation

### CLI Syntax
```bash
DgnExporter.exe <input_dgn>
```

### Supported Versions
| Version | Description |
|---------|-------------|
| V7 DGN | Legacy MicroStation format (pre-V8) |
| V8 DGN | Modern MicroStation format |
| V8i DGN | MicroStation V8i format |

### Output Format
| Output | Description |
|--------|-------------|
| `.xlsx` | Excel database with all elements |

### Examples

```bash
# Basic conversion
DgnExporter.exe "C:\Projects\Bridge.dgn"

# Batch processing
for /R "C:\Infrastructure" %f in (*.dgn) do DgnExporter.exe "%f"

# PowerShell batch
Get-ChildItem "C:\Projects\*.dgn" -Recurse | ForEach-Object {
    & "C:\Jens\DgnExporter.exe" $_.FullName
}
```

### Python Integration

```python
import subprocess
import pandas as pd
from pathlib import Path
from typing import List, Optional, Dict, Any
from dataclasses import dataclass
from enum import Enum


class DGNElementType(Enum):
    """DGN element types."""
    CELL_HEADER = 2
    LINE = 3
    LINE_STRING = 4
    SHAPE = 6
    TEXT_NODE = 7
    CURVE = 11
    COMPLEX_CHAIN = 12
    COMPLEX_SHAPE = 14
    ELLIPSE = 15
    ARC = 16
    TEXT = 17
    SURFACE = 18
    SOLID = 19
    BSPLINE_CURVE = 21
    POINT_STRING = 22
    DIMENSION = 33
    SHARED_CELL = 35


@dataclass
class DGNElement:
    """Represents a DGN element."""
    element_id: int
    element_type: int
    type_name: str
    level: int
    color: int
    weight: int
    style: int

    # Geometry
    range_low_x: Optional[float] = None
    range_low_y: Optional[float] = None
    range_low_z: Optional[float] = None
    range_high_x: Optional[float] = None
    range_high_y: Optional[float] = None
    range_high_z: Optional[float] = None

    # Cell/Text specific
    cell_name: Optional[str] = None
    text_content: Optional[str] = None


@dataclass
class DGNLevel:
    """Represents a DGN level."""
    number: int
    name: str
    is_displayed: bool
    is_frozen: bool
    element_count: int


class DGNExporter:
    """DGN to Excel converter using Jens DgnExporter CLI."""

    def __init__(self, exporter_path: str = "DgnExporter.exe"):
        self.exporter = Path(exporter_path)
        if not self.exporter.exists():
            raise FileNotFoundError(f"DgnExporter not found: {exporter_path}")

    def convert(self, dgn_file: str) -> Path:
        """Convert DGN file to Excel."""
        dgn_path = Path(dgn_file)
        if not dgn_path.exists():
            raise FileNotFoundError(f"DGN file not found: {dgn_file}")

        cmd = [str(self.exporter), str(dgn_path)]
        result = subprocess.run(cmd, capture_output=True, text=True)

        if result.returncode != 0:
            raise RuntimeError(f"Export failed: {result.stderr}")

        return dgn_path.with_suffix('.xlsx')

    def batch_convert(self, folder: str,
                      include_subfolders: bool = True) -> List[Dict[str, Any]]:
        """Convert all DGN files in folder."""
        folder_path = Path(folder)
        pattern = "**/*.dgn" if include_subfolders else "*.dgn"

        results = []
        for dgn_file in folder_path.glob(pattern):
            try:
                output = self.convert(str(dgn_file))
                results.append({
                    'input': str(dgn_file),
                    'output': str(output),
                    'status': 'success'
                })
                print(f"✓ Converted: {dgn_file.name}")
            except Exception as e:
                results.append({
                    'input': str(dgn_file),
                    'output': None,
                    'status': 'failed',
                    'error': str(e)
                })
                print(f"✗ Failed: {dgn_file.name} - {e}")

        return results

    def read_elements(self, xlsx_file: str) -> pd.DataFrame:
        """Read converted Excel as DataFrame."""
        return pd.read_excel(xlsx_file, sheet_name="Elements")

    def get_levels(self, xlsx_file: str) -> pd.DataFrame:
        """Get level summary."""
        df = self.read_elements(xlsx_file)

        if 'Level' not in df.columns:
            raise ValueError("Level column not found")

        summary = df.groupby('Level').agg({
            'ElementId': 'count'
        }).reset_index()
        summary.columns = ['Level', 'Element_Count']
        return summary.sort_values('Level')

    def get_element_types(self, xlsx_file: str) -> pd.DataFrame:
        """Get element type statistics."""
        df = self.read_elements(xlsx_file)

        type_col = 'ElementType' if 'ElementType' in df.columns else 'Type'
        if type_col not in df.columns:
            return pd.DataFrame()

        summary = df.groupby(type_col).agg({
            'ElementId': 'count'
        }).reset_index()
        summary.columns = ['Element_Type', 'Count']
        return summary.sort_values('Count', ascending=False)

    def get_cells(self, xlsx_file: str) -> pd.DataFrame:
        """Get cell references (similar to blocks in DWG)."""
        df = self.read_elements(xlsx_file)

        # Filter to cell elements
        cells = df[df['ElementType'].isin([2, 35])]  # CELL_HEADER, SHARED_CELL

        if cells.empty or 'CellName' not in cells.columns:
            return pd.DataFrame(columns=['Cell_Name', 'Count'])

        summary = cells.groupby('CellName').agg({
            'ElementId': 'count'
        }).reset_index()
        summary.columns = ['Cell_Name', 'Count']
        return summary.sort_values('Count', ascending=False)

    def get_text_content(self, xlsx_file: str) -> pd.DataFrame:
        """Extract all text from DGN."""
        df = self.read_elements(xlsx_file)

        # Filter to text elements
        text_types = [7, 17]  # TEXT_NODE, TEXT
        texts = df[df['ElementType'].isin(text_types)]

        if 'TextContent' in texts.columns:
            return texts[['ElementId', 'Level', 'TextContent']].copy()
        return texts[['ElementId', 'Level']].copy()

    def get_statistics(self, xlsx_file: str) -> Dict[str, Any]:
        """Get comprehensive DGN statistics."""
        df = self.read_elements(xlsx_file)

        stats = {
            'total_elements': len(df),
            'levels_used': df['Level'].nunique() if 'Level' in df.columns else 0,
            'element_types': df['ElementType'].nunique() if 'ElementType' in df.columns else 0
        }

        # Calculate extents
        for coord in ['X', 'Y', 'Z']:
            low_col = f'RangeLow{coord}'
            high_col = f'RangeHigh{coord}'
            if low_col in df.columns and high_col in df.columns:
                stats[f'min_{coord.lower()}'] = df[low_col].min()
                stats[f'max_{coord.lower()}'] = df[high_col].max()

        return stats


class DGNAnalyzer:
    """Advanced DGN analysis for infrastructure projects."""

    def __init__(self, exporter: DGNExporter):
        self.exporter = exporter

    def analyze_infrastructure(self, dgn_file: str) -> Dict[str, Any]:
        """Analyze DGN for infrastructure elements."""
        xlsx = self.exporter.convert(dgn_file)
        df = self.exporter.read_elements(str(xlsx))

        analysis = {
            'file': dgn_file,
            'statistics': self.exporter.get_statistics(str(xlsx)),
            'levels': self.exporter.get_levels(str(xlsx)).to_dict('records'),
            'element_types': self.exporter.get_element_types(str(xlsx)).to_dict('records'),
            'cells': self.exporter.get_cells(str(xlsx)).to_dict('records')
        }

        # Identify infrastructure-specific elements
        if 'ElementType' in df.columns:
            # Lines and shapes (often roads, boundaries)
            lines = df[df['ElementType'].isin([3, 4, 6, 14])].shape[0]
            analysis['linear_elements'] = lines

            # Complex elements (often structures)
            complex_elements = df[df['ElementType'].isin([12, 14, 18, 19])].shape[0]
            analysis['complex_elements'] = complex_elements

            # Annotation elements
            annotations = df[df['ElementType'].isin([7, 17, 33])].shape[0]
            analysis['annotations'] = annotations

        return analysis

    def compare_revisions(self, dgn1: str, dgn2: str) -> Dict[str, Any]:
        """Compare two DGN revisions."""
        xlsx1 = self.exporter.convert(dgn1)
        xlsx2 = self.exporter.convert(dgn2)

        df1 = self.exporter.read_elements(str(xlsx1))
        df2 = self.exporter.read_elements(str(xlsx2))

        levels1 = set(df1['Level'].unique()) if 'Level' in df1.columns else set()
        levels2 = set(df2['Level'].unique()) if 'Level' in df2.columns else set()

        return {
            'revision1': dgn1,
            'revision2': dgn2,
            'element_count_diff': len(df2) - len(df1),
            'levels_added': list(levels2 - levels1),
            'levels_removed': list(levels1 - levels2),
            'common_levels': len(levels1 & levels2)
        }

    def extract_coordinates(self, xlsx_file: str) -> pd.DataFrame:
        """Extract element coordinates for GIS integration."""
        df = self.exporter.read_elements(xlsx_file)

        coord_cols = ['ElementId', 'Level', 'ElementType']
        for col in ['RangeLowX', 'RangeLowY', 'RangeLowZ',
                    'RangeHighX', 'RangeHighY', 'RangeHighZ',
                    'CenterX', 'CenterY', 'CenterZ']:
            if col in df.columns:
                coord_cols.append(col)

        return df[coord_cols].copy()


class DGNLevelManager:
    """Manage DGN level structures."""

    def __init__(self, exporter: DGNExporter):
        self.exporter = exporter

    def get_level_map(self, xlsx_file: str) -> Dict[int, str]:
        """Create level number to name mapping."""
        df = self.exporter.read_elements(xlsx_file)

        if 'Level' not in df.columns:
            return {}

        # MicroStation levels are typically numbered 1-63 (V7) or unlimited (V8)
        level_map = {}
        for level in df['Level'].unique():
            level_map[int(level)] = f"Level_{level}"

        return level_map

    def filter_by_levels(self, xlsx_file: str,
                         levels: List[int]) -> pd.DataFrame:
        """Filter elements by level numbers."""
        df = self.exporter.read_elements(xlsx_file)
        return df[df['Level'].isin(levels)]

    def get_level_usage_report(self, xlsx_file: str) -> pd.DataFrame:
        """Generate level usage report."""
        df = self.exporter.read_elements(xlsx_file)

        if 'Level' not in df.columns or 'ElementType' not in df.columns:
            return pd.DataFrame()

        # Cross-tabulate levels and element types
        report = pd.crosstab(df['Level'], df['ElementType'], margins=True)
        return report


# Convenience functions
def convert_dgn_to_excel(dgn_file: str,
                         exporter_path: str = "DgnExporter.exe") -> str:
    """Quick conversion of DGN to Excel."""
    exporter = DGNExporter(exporter_path)
    output = exporter.convert(dgn_file)
    return str(output)


def analyze_dgn(dgn_file: str,
                exporter_path: str = "DgnExporter.exe") -> Dict[str, Any]:
    """Analyze DGN file and return summary."""
    exporter = DGNExporter(exporter_path)
    analyzer = DGNAnalyzer(exporter)
    return analyzer.analyze_infrastructure(dgn_file)
```

## Output Structure

### Excel Sheets
| Sheet | Content |
|-------|---------|
| Elements | All DGN elements with properties |
| Levels | Level definitions |
| Cells | Cell library |

### Element Columns
| Column | Type | Description |
|--------|------|-------------|
| ElementId | int | Unique element ID |
| ElementType | int | Type code (3=Line, 17=Text, etc.) |
| Level | int | Level number |
| Color | int | Color index |
| Weight | int | Line weight |
| Style | int | Line style |
| RangeLowX/Y/Z | float | Bounding box minimum |
| RangeHighX/Y/Z | float | Bounding box maximum |
| CellName | string | Cell name (for cell elements) |
| TextContent | string | Text content (for text elements) |

## Quick Start

```python
# Initialize exporter
exporter = DGNExporter("C:/Jens/DgnExporter.exe")

# Convert DGN to Excel
xlsx = exporter.convert("C:/Projects/Highway.dgn")
print(f"Output: {xlsx}")

# Read elements
df = exporter.read_elements(str(xlsx))
print(f"Total elements: {len(df)}")

# Get level statistics
levels = exporter.get_levels(str(xlsx))
print(levels)

# Get element types
types = exporter.get_element_types(str(xlsx))
print(types)
```

## Common Use Cases

### 1. Infrastructure Analysis
```python
exporter = DGNExporter()
analyzer = DGNAnalyzer(exporter)

analysis = analyzer.analyze_infrastructure("highway.dgn")
print(f"Total elements: {analysis['statistics']['total_elements']}")
print(f"Linear elements: {analysis['linear_elements']}")
print(f"Annotations: {analysis['annotations']}")
```

### 2. Level Audit
```python
exporter = DGNExporter()
xlsx = exporter.convert("bridge.dgn")
levels = exporter.get_levels(str(xlsx))

# Check for unused standard levels
for idx, row in levels.iterrows():
    print(f"Level {row['Level']}: {row['Element_Count']} elements")
```

### 3. GIS Integration
```python
analyzer = DGNAnalyzer(exporter)
xlsx = exporter.convert("utilities.dgn")
coords = analyzer.extract_coordinates(str(xlsx))

# Export for GIS
coords.to_csv("coordinates.csv", index=False)
```

### 4. Revision Comparison
```python
analyzer = DGNAnalyzer(exporter)
diff = analyzer.compare_revisions("rev1.dgn", "rev2.dgn")
print(f"Elements changed: {diff['element_count_diff']}")
```

## Integration with Jens Pipeline

```python
# Infrastructure pipeline: DGN → Excel → Analysis
from dgn_exporter import DGNExporter, DGNAnalyzer

# 1. Convert DGN
exporter = DGNExporter("C:/Jens/DgnExporter.exe")
xlsx = exporter.convert("highway_project.dgn")

# 2. Analyze structure
stats = exporter.get_statistics(str(xlsx))
print(f"Elements: {stats['total_elements']}")
print(f"Levels: {stats['levels_used']}")

# 3. Extract for GIS
analyzer = DGNAnalyzer(exporter)
coords = analyzer.extract_coordinates(str(xlsx))
coords.to_csv("for_gis.csv", index=False)
```

## Best Practices

1. **Check version** - V7 and V8 have different capabilities
2. **Reference files** - Process all reference files separately
3. **Level mapping** - Document level standards for your organization
4. **Coordinate systems** - Verify units and coordinate systems
5. **Cell libraries** - Export cells separately if needed

## Resources

- **GitHub**: [cad2data Pipeline](https://github.com/jens-construction/cad2data-Revit-IFC-DWG-DGN-pipeline-with-conversion-validation-qto)
- **Jens Book**: Chapter 2.4 - CAD Data Extraction
- **MicroStation**: Infrastructure-focused CAD software


---


# DWG to Excel Conversion

## Business Case

### Problem Statement
AutoCAD DWG files contain valuable project data locked in proprietary format:
- Layer structures with drawing organization
- Block references with attribute data
- Text annotations and dimensions
- Geometric entities (lines, polylines, arcs)
- External references (xrefs)

Extracting this data typically requires AutoCAD licenses or complex programming.

### Solution
DwgExporter.exe converts DWG files to structured Excel databases offline, without Autodesk licenses.

### Business Value
- **Zero license cost** - No AutoCAD license required
- **Legacy support** - Reads DWG files from 1983 to 2026
- **Data extraction** - Layers, blocks, attributes, text, geometry
- **PDF export** - Generate drawings from DWG layouts
- **Batch processing** - Convert thousands of DWG files

## Technical Implementation

### CLI Syntax
```bash
DwgExporter.exe <input_dwg> [options]
```

### Output Formats
| Output | Description |
|--------|-------------|
| `.xlsx` | Excel database with all entities |
| `.pdf` | PDF drawings from layouts |

### Supported Versions
| Version Range | Description |
|---------------|-------------|
| R12 (1992) | Legacy DWG |
| R14 (1997) | AutoCAD 14 |
| 2000-2002 | DWG 2000 format |
| 2004-2006 | DWG 2004 format |
| 2007-2009 | DWG 2007 format |
| 2010-2012 | DWG 2010 format |
| 2013-2017 | DWG 2013 format |
| 2018-2026 | DWG 2018 format |

### Examples

```bash
# Basic conversion
DwgExporter.exe "C:\Projects\FloorPlan.dwg"

# Export with PDF drawings
DwgExporter.exe "C:\Projects\FloorPlan.dwg" sheets2pdf

# Batch processing all DWG in folder
for /R "C:\Projects" %f in (*.dwg) do DwgExporter.exe "%f"

# PowerShell batch conversion
Get-ChildItem "C:\Projects\*.dwg" -Recurse | ForEach-Object {
    & "C:\Jens\DwgExporter.exe" $_.FullName
}
```

### Python Integration

```python
import subprocess
import pandas as pd
from pathlib import Path
from typing import List, Optional, Dict, Any
from dataclasses import dataclass
from enum import Enum


class DWGEntityType(Enum):
    """DWG entity types."""
    LINE = "LINE"
    POLYLINE = "POLYLINE"
    LWPOLYLINE = "LWPOLYLINE"
    CIRCLE = "CIRCLE"
    ARC = "ARC"
    ELLIPSE = "ELLIPSE"
    SPLINE = "SPLINE"
    TEXT = "TEXT"
    MTEXT = "MTEXT"
    DIMENSION = "DIMENSION"
    INSERT = "INSERT"  # Block reference
    HATCH = "HATCH"
    SOLID = "SOLID"
    POINT = "POINT"
    ATTRIB = "ATTRIB"
    ATTDEF = "ATTDEF"


@dataclass
class DWGEntity:
    """Represents a DWG entity."""
    handle: str
    entity_type: str
    layer: str
    color: int
    linetype: str
    lineweight: float

    # Geometry (depends on entity type)
    start_x: Optional[float] = None
    start_y: Optional[float] = None
    end_x: Optional[float] = None
    end_y: Optional[float] = None

    # Block reference data
    block_name: Optional[str] = None
    rotation: Optional[float] = None
    scale_x: Optional[float] = None
    scale_y: Optional[float] = None

    # Text data
    text_content: Optional[str] = None
    text_height: Optional[float] = None


@dataclass
class DWGBlock:
    """Represents a DWG block definition."""
    name: str
    base_point_x: float
    base_point_y: float
    entity_count: int
    is_dynamic: bool
    attributes: List[str]


@dataclass
class DWGLayer:
    """Represents a DWG layer."""
    name: str
    color: int
    linetype: str
    is_on: bool
    is_frozen: bool
    is_locked: bool
    lineweight: float
    entity_count: int


class DWGExporter:
    """DWG to Excel converter using Jens DwgExporter CLI."""

    def __init__(self, exporter_path: str = "DwgExporter.exe"):
        self.exporter = Path(exporter_path)
        if not self.exporter.exists():
            raise FileNotFoundError(f"DwgExporter not found: {exporter_path}")

    def convert(self, dwg_file: str,
                export_pdf: bool = False) -> Path:
        """Convert DWG file to Excel."""
        dwg_path = Path(dwg_file)
        if not dwg_path.exists():
            raise FileNotFoundError(f"DWG file not found: {dwg_file}")

        cmd = [str(self.exporter), str(dwg_path)]
        if export_pdf:
            cmd.append("sheets2pdf")

        result = subprocess.run(cmd, capture_output=True, text=True)

        if result.returncode != 0:
            raise RuntimeError(f"Export failed: {result.stderr}")

        # Output file is same name with .xlsx extension
        return dwg_path.with_suffix('.xlsx')

    def batch_convert(self, folder: str,
                      include_subfolders: bool = True,
                      export_pdf: bool = False) -> List[Dict[str, Any]]:
        """Convert all DWG files in folder."""
        folder_path = Path(folder)
        pattern = "**/*.dwg" if include_subfolders else "*.dwg"

        results = []
        for dwg_file in folder_path.glob(pattern):
            try:
                output = self.convert(str(dwg_file), export_pdf)
                results.append({
                    'input': str(dwg_file),
                    'output': str(output),
                    'status': 'success'
                })
                print(f"✓ Converted: {dwg_file.name}")
            except Exception as e:
                results.append({
                    'input': str(dwg_file),
                    'output': None,
                    'status': 'failed',
                    'error': str(e)
                })
                print(f"✗ Failed: {dwg_file.name} - {e}")

        return results

    def read_entities(self, xlsx_file: str) -> pd.DataFrame:
        """Read converted Excel as DataFrame."""
        xlsx_path = Path(xlsx_file)
        if not xlsx_path.exists():
            raise FileNotFoundError(f"Excel file not found: {xlsx_file}")

        return pd.read_excel(xlsx_file, sheet_name="Elements")

    def get_layers(self, xlsx_file: str) -> pd.DataFrame:
        """Get layer summary from converted file."""
        df = self.read_entities(xlsx_file)

        if 'Layer' not in df.columns:
            raise ValueError("Layer column not found in data")

        summary = df.groupby('Layer').agg({
            'Handle': 'count'
        }).reset_index()
        summary.columns = ['Layer', 'Entity_Count']
        return summary.sort_values('Entity_Count', ascending=False)

    def get_blocks(self, xlsx_file: str) -> pd.DataFrame:
        """Get block reference summary."""
        df = self.read_entities(xlsx_file)

        # Filter to INSERT entities (block references)
        blocks = df[df['EntityType'] == 'INSERT']

        if blocks.empty:
            return pd.DataFrame(columns=['Block_Name', 'Count'])

        summary = blocks.groupby('BlockName').agg({
            'Handle': 'count'
        }).reset_index()
        summary.columns = ['Block_Name', 'Count']
        return summary.sort_values('Count', ascending=False)

    def get_text_content(self, xlsx_file: str) -> pd.DataFrame:
        """Extract all text content from DWG."""
        df = self.read_entities(xlsx_file)

        # Filter to text entities
        text_types = ['TEXT', 'MTEXT', 'ATTRIB']
        texts = df[df['EntityType'].isin(text_types)]

        if 'TextContent' in texts.columns:
            return texts[['Handle', 'EntityType', 'Layer', 'TextContent']].copy()
        return texts[['Handle', 'EntityType', 'Layer']].copy()

    def get_entity_statistics(self, xlsx_file: str) -> Dict[str, int]:
        """Get entity type statistics."""
        df = self.read_entities(xlsx_file)

        if 'EntityType' not in df.columns:
            return {}

        return df['EntityType'].value_counts().to_dict()

    def extract_block_attributes(self, xlsx_file: str,
                                  block_name: str) -> pd.DataFrame:
        """Extract attributes from specific block type."""
        df = self.read_entities(xlsx_file)

        # Find block references
        blocks = df[(df['EntityType'] == 'INSERT') &
                    (df['BlockName'] == block_name)]

        # Find associated attributes
        # Attributes typically follow their parent INSERT in handle order
        result_data = []

        for _, block in blocks.iterrows():
            block_handle = block['Handle']
            block_data = {
                'Block_Handle': block_handle,
                'X': block.get('InsertX', 0),
                'Y': block.get('InsertY', 0),
                'Rotation': block.get('Rotation', 0)
            }

            # Add any attribute columns
            for col in df.columns:
                if col.startswith('Attr_'):
                    block_data[col] = block.get(col)

            result_data.append(block_data)

        return pd.DataFrame(result_data)


class DWGAnalyzer:
    """Advanced DWG analysis tools."""

    def __init__(self, exporter: DWGExporter):
        self.exporter = exporter

    def analyze_drawing_structure(self, dwg_file: str) -> Dict[str, Any]:
        """Analyze complete drawing structure."""
        xlsx = self.exporter.convert(dwg_file)
        df = self.exporter.read_entities(str(xlsx))

        analysis = {
            'file': dwg_file,
            'total_entities': len(df),
            'layers': self.exporter.get_layers(str(xlsx)).to_dict('records'),
            'entity_types': self.exporter.get_entity_statistics(str(xlsx)),
            'blocks': self.exporter.get_blocks(str(xlsx)).to_dict('records')
        }

        # Calculate extents if coordinates available
        if 'X' in df.columns and 'Y' in df.columns:
            analysis['extents'] = {
                'min_x': df['X'].min(),
                'max_x': df['X'].max(),
                'min_y': df['Y'].min(),
                'max_y': df['Y'].max()
            }

        return analysis

    def compare_drawings(self, dwg1: str, dwg2: str) -> Dict[str, Any]:
        """Compare two DWG files."""
        xlsx1 = self.exporter.convert(dwg1)
        xlsx2 = self.exporter.convert(dwg2)

        df1 = self.exporter.read_entities(str(xlsx1))
        df2 = self.exporter.read_entities(str(xlsx2))

        layers1 = set(df1['Layer'].unique()) if 'Layer' in df1.columns else set()
        layers2 = set(df2['Layer'].unique()) if 'Layer' in df2.columns else set()

        return {
            'file1': dwg1,
            'file2': dwg2,
            'entity_count_diff': len(df2) - len(df1),
            'layers_added': list(layers2 - layers1),
            'layers_removed': list(layers1 - layers2),
            'common_layers': list(layers1 & layers2)
        }

    def find_duplicates(self, xlsx_file: str,
                        tolerance: float = 0.001) -> pd.DataFrame:
        """Find duplicate entities at same location."""
        df = self.exporter.read_entities(xlsx_file)

        if 'X' not in df.columns or 'Y' not in df.columns:
            return pd.DataFrame()

        # Round coordinates for grouping
        df['X_rounded'] = (df['X'] / tolerance).round() * tolerance
        df['Y_rounded'] = (df['Y'] / tolerance).round() * tolerance

        # Find duplicates
        duplicates = df[df.duplicated(
            subset=['EntityType', 'Layer', 'X_rounded', 'Y_rounded'],
            keep=False
        )]

        return duplicates.sort_values(['X_rounded', 'Y_rounded'])


# Convenience functions
def convert_dwg_to_excel(dwg_file: str,
                         exporter_path: str = "DwgExporter.exe") -> str:
    """Quick conversion of DWG to Excel."""
    exporter = DWGExporter(exporter_path)
    output = exporter.convert(dwg_file)
    return str(output)


def batch_convert_dwg(folder: str,
                      exporter_path: str = "DwgExporter.exe",
                      include_subfolders: bool = True) -> List[str]:
    """Batch convert all DWG files in folder."""
    exporter = DWGExporter(exporter_path)
    results = exporter.batch_convert(folder, include_subfolders)
    return [r['output'] for r in results if r['status'] == 'success']
```

## Output Structure

### Excel Sheets
| Sheet | Content |
|-------|---------|
| Elements | All DWG entities with properties |
| Layers | Layer definitions |
| Blocks | Block definitions |
| Layouts | Drawing layouts/sheets |

### Entity Columns
| Column | Type | Description |
|--------|------|-------------|
| Handle | string | Unique entity handle |
| EntityType | string | LINE, CIRCLE, INSERT, etc. |
| Layer | string | Layer name |
| Color | int | Color index (0-256) |
| Linetype | string | Linetype name |
| Lineweight | float | Line weight in mm |
| X, Y, Z | float | Entity coordinates |
| BlockName | string | For INSERT entities |
| TextContent | string | For TEXT/MTEXT |

## Quick Start

```python
# Initialize exporter
exporter = DWGExporter("C:/Jens/DwgExporter.exe")

# Convert single file
xlsx = exporter.convert("C:/Projects/Plan.dwg")
print(f"Output: {xlsx}")

# Read and analyze
df = exporter.read_entities(str(xlsx))
print(f"Total entities: {len(df)}")

# Get layer statistics
layers = exporter.get_layers(str(xlsx))
print(layers)

# Get block usage
blocks = exporter.get_blocks(str(xlsx))
print(blocks)

# Extract text annotations
texts = exporter.get_text_content(str(xlsx))
for _, row in texts.iterrows():
    print(f"{row['Layer']}: {row.get('TextContent', 'N/A')}")
```

## Common Use Cases

### 1. Layer Audit
```python
exporter = DWGExporter()
xlsx = exporter.convert("drawing.dwg")
layers = exporter.get_layers(str(xlsx))

# Check for non-standard layers
standard_layers = ['0', 'WALLS', 'DOORS', 'WINDOWS', 'DIMENSIONS']
non_standard = layers[~layers['Layer'].isin(standard_layers)]
print("Non-standard layers:", non_standard['Layer'].tolist())
```

### 2. Block Schedule
```python
# Extract all door blocks with attributes
doors = exporter.extract_block_attributes(str(xlsx), "DOOR")
print(doors[['Block_Handle', 'Attr_DOOR_TYPE', 'Attr_DOOR_SIZE']])
```

### 3. Drawing Comparison
```python
analyzer = DWGAnalyzer(exporter)
diff = analyzer.compare_drawings("rev1.dwg", "rev2.dwg")
print(f"Entities added: {diff['entity_count_diff']}")
print(f"New layers: {diff['layers_added']}")
```

## Integration with Jens Pipeline

```python
# Full pipeline: DWG → Excel → Analysis → Report
from dwg_exporter import DWGExporter, DWGAnalyzer

# 1. Convert DWG
exporter = DWGExporter("C:/Jens/DwgExporter.exe")
xlsx = exporter.convert("project.dwg")

# 2. Analyze structure
analyzer = DWGAnalyzer(exporter)
analysis = analyzer.analyze_drawing_structure("project.dwg")

# 3. Generate report
print(f"Drawing: {analysis['file']}")
print(f"Entities: {analysis['total_entities']}")
print(f"Layers: {len(analysis['layers'])}")
print(f"Blocks: {len(analysis['blocks'])}")
```

## Best Practices

1. **Check DWG version** - Older files may have limited data
2. **Validate layer structure** - Clean up before processing
3. **Handle external references** - Bind xrefs if needed
4. **Batch overnight** - Large files take time
5. **Verify entity counts** - Compare with AutoCAD if possible

## Resources

- **GitHub**: [cad2data Pipeline](https://github.com/jens-construction/cad2data-Revit-IFC-DWG-DGN-pipeline-with-conversion-validation-qto)
- **Video Tutorial**: [DWG to Excel Pipeline](https://www.youtube.com/watch?v=jVU7vlMNTO0)
- **Jens Book**: Chapter 2.4 - CAD Data Extraction


---


# Excel to BIM Update

## Business Case

### Problem Statement
After extracting BIM data to Excel and enriching it (cost codes, classifications, custom data):
- Changes need to flow back to the BIM model
- Manual re-entry is error-prone
- Updates must match by element ID

### Solution
Push Excel data back to BIM models, updating element parameters and properties from spreadsheet changes.

### Business Value
- **Bi-directional workflow** - BIM → Excel → BIM
- **Bulk updates** - Change thousands of parameters
- **Data enrichment** - Add classifications, codes, costs
- **Consistency** - Spreadsheet as single source of truth

## Technical Implementation

### Workflow
```
BIM Model (Revit/IFC) → Excel Export → Data Enrichment → Excel Update → BIM Model
```

### Python Implementation

```python
import pandas as pd
from pathlib import Path
from typing import Dict, Any, List, Optional, Tuple
from dataclasses import dataclass, field
from enum import Enum
import json


class UpdateType(Enum):
    """Type of BIM parameter update."""
    TEXT = "text"
    NUMBER = "number"
    BOOLEAN = "boolean"
    ELEMENT_ID = "element_id"


@dataclass
class ParameterMapping:
    """Mapping between Excel column and BIM parameter."""
    excel_column: str
    bim_parameter: str
    update_type: UpdateType
    transform: Optional[str] = None  # Optional transformation


@dataclass
class UpdateResult:
    """Result of single element update."""
    element_id: str
    parameters_updated: List[str]
    success: bool
    error: Optional[str] = None


@dataclass
class BatchUpdateResult:
    """Result of batch update operation."""
    total_elements: int
    updated: int
    failed: int
    skipped: int
    results: List[UpdateResult]


class ExcelToBIMUpdater:
    """Update BIM models from Excel data."""

    # Standard ID column names
    ID_COLUMNS = ['ElementId', 'GlobalId', 'GUID', 'Id', 'UniqueId']

    def __init__(self):
        self.mappings: List[ParameterMapping] = []

    def add_mapping(self, excel_col: str, bim_param: str,
                    update_type: UpdateType = UpdateType.TEXT):
        """Add column to parameter mapping."""
        self.mappings.append(ParameterMapping(
            excel_column=excel_col,
            bim_parameter=bim_param,
            update_type=update_type
        ))

    def load_excel(self, file_path: str,
                   sheet_name: str = None) -> pd.DataFrame:
        """Load Excel data for update."""
        if sheet_name:
            return pd.read_excel(file_path, sheet_name=sheet_name)
        return pd.read_excel(file_path)

    def detect_id_column(self, df: pd.DataFrame) -> Optional[str]:
        """Detect element ID column in DataFrame."""
        for col in self.ID_COLUMNS:
            if col in df.columns:
                return col
            # Case-insensitive check
            for df_col in df.columns:
                if df_col.lower() == col.lower():
                    return df_col
        return None

    def prepare_updates(self, df: pd.DataFrame,
                        id_column: str = None) -> List[Dict[str, Any]]:
        """Prepare update instructions from DataFrame."""

        if id_column is None:
            id_column = self.detect_id_column(df)
            if id_column is None:
                raise ValueError("Cannot detect ID column")

        updates = []

        for _, row in df.iterrows():
            element_id = str(row[id_column])

            params = {}
            for mapping in self.mappings:
                if mapping.excel_column in df.columns:
                    value = row[mapping.excel_column]

                    # Convert value based on type
                    if mapping.update_type == UpdateType.NUMBER:
                        value = float(value) if pd.notna(value) else 0
                    elif mapping.update_type == UpdateType.BOOLEAN:
                        value = bool(value) if pd.notna(value) else False
                    elif mapping.update_type == UpdateType.TEXT:
                        value = str(value) if pd.notna(value) else ""

                    params[mapping.bim_parameter] = value

            if params:
                updates.append({
                    'element_id': element_id,
                    'parameters': params
                })

        return updates

    def generate_dynamo_script(self, updates: List[Dict],
                               output_path: str) -> str:
        """Generate Dynamo script for Revit updates."""

        # Generate Python code for Dynamo
        script = '''
# Dynamo Python Script for Revit Parameter Updates
# Generated by Jens Excel-to-BIM

import clr
clr.AddReference('RevitAPI')
clr.AddReference('RevitServices')
from RevitServices.Persistence import DocumentManager
from RevitServices.Transactions import TransactionManager
from Autodesk.Revit.DB import *

doc = DocumentManager.Instance.CurrentDBDocument

# Update data
updates = '''
        script += json.dumps(updates, indent=2)
        script += '''

# Apply updates
TransactionManager.Instance.EnsureInTransaction(doc)

results = []
for update in updates:
    try:
        element_id = int(update['element_id'])
        element = doc.GetElement(ElementId(element_id))

        if element:
            for param_name, value in update['parameters'].items():
                param = element.LookupParameter(param_name)
                if param and not param.IsReadOnly:
                    if isinstance(value, (int, float)):
                        param.Set(float(value))
                    elif isinstance(value, bool):
                        param.Set(1 if value else 0)
                    else:
                        param.Set(str(value))
            results.append({'id': element_id, 'status': 'success'})
        else:
            results.append({'id': element_id, 'status': 'not found'})
    except Exception as e:
        results.append({'id': update['element_id'], 'status': str(e)})

TransactionManager.Instance.TransactionTaskDone()

OUT = results
'''

        with open(output_path, 'w') as f:
            f.write(script)

        return output_path

    def generate_ifc_updates(self, updates: List[Dict],
                             original_ifc: str,
                             output_ifc: str) -> str:
        """Generate updated IFC file (requires IfcOpenShell)."""

        try:
            import ifcopenshell
        except ImportError:
            raise ImportError("IfcOpenShell required for IFC updates")

        ifc = ifcopenshell.open(original_ifc)

        for update in updates:
            guid = update['element_id']

            # Find element by GUID
            element = ifc.by_guid(guid)
            if not element:
                continue

            # Update properties
            for param_name, value in update['parameters'].items():
                # This is simplified - actual IFC property handling is more complex
                # Would need to find/create property sets and properties
                pass

        ifc.write(output_ifc)
        return output_ifc

    def generate_update_report(self, original_df: pd.DataFrame,
                               updates: List[Dict],
                               output_path: str) -> str:
        """Generate report of planned updates."""

        report_data = []
        for update in updates:
            for param, value in update['parameters'].items():
                report_data.append({
                    'element_id': update['element_id'],
                    'parameter': param,
                    'new_value': value
                })

        report_df = pd.DataFrame(report_data)
        report_df.to_excel(output_path, index=False)
        return output_path


class RevitExcelUpdater(ExcelToBIMUpdater):
    """Specialized updater for Revit via ImportExcelToRevit."""

    def __init__(self, tool_path: str = "ImportExcelToRevit.exe"):
        super().__init__()
        self.tool_path = Path(tool_path)

    def update_revit(self, excel_file: str,
                     rvt_file: str,
                     sheet_name: str = "Elements") -> BatchUpdateResult:
        """Update Revit file from Excel using CLI tool."""

        import subprocess

        # This assumes ImportExcelToRevit CLI tool
        cmd = [
            str(self.tool_path),
            rvt_file,
            excel_file,
            sheet_name
        ]

        result = subprocess.run(cmd, capture_output=True, text=True)

        # Parse results (format depends on tool output)
        if result.returncode == 0:
            return BatchUpdateResult(
                total_elements=0,  # Would parse from output
                updated=0,
                failed=0,
                skipped=0,
                results=[]
            )
        else:
            raise RuntimeError(f"Update failed: {result.stderr}")


class DataEnrichmentWorkflow:
    """Complete workflow for data enrichment and update."""

    def __init__(self):
        self.updater = ExcelToBIMUpdater()

    def enrich_and_update(self, original_excel: str,
                          enrichment_excel: str,
                          merge_column: str) -> pd.DataFrame:
        """Merge enrichment data with original export."""

        original = pd.read_excel(original_excel)
        enrichment = pd.read_excel(enrichment_excel)

        # Merge on specified column
        merged = original.merge(enrichment, on=merge_column, how='left',
                                suffixes=('', '_enriched'))

        return merged

    def create_classification_mapping(self, df: pd.DataFrame,
                                      type_column: str,
                                      classification_file: str) -> pd.DataFrame:
        """Map BIM types to classification codes."""

        classifications = pd.read_excel(classification_file)

        # Fuzzy matching could be added here
        merged = df.merge(classifications,
                          left_on=type_column,
                          right_on='type_description',
                          how='left')

        return merged
```

## Quick Start

```python
# Initialize updater
updater = ExcelToBIMUpdater()

# Define mappings
updater.add_mapping('Classification_Code', 'OmniClassCode', UpdateType.TEXT)
updater.add_mapping('Unit_Cost', 'Cost', UpdateType.NUMBER)

# Load enriched Excel
df = updater.load_excel("enriched_model.xlsx")

# Prepare updates
updates = updater.prepare_updates(df)
print(f"Prepared {len(updates)} updates")

# Generate Dynamo script for Revit
updater.generate_dynamo_script(updates, "update_parameters.py")
```

## Common Use Cases

### 1. Add Classification Codes
```python
updater = ExcelToBIMUpdater()
updater.add_mapping('Omniclass', 'OmniClass_Number', UpdateType.TEXT)
updater.add_mapping('Uniclass', 'Uniclass_Code', UpdateType.TEXT)

df = updater.load_excel("classified_elements.xlsx")
updates = updater.prepare_updates(df)
```

### 2. Cost Data Integration
```python
updater.add_mapping('Material_Cost', 'Pset_MaterialCost', UpdateType.NUMBER)
updater.add_mapping('Labor_Cost', 'Pset_LaborCost', UpdateType.NUMBER)
```

### 3. Generate Update Report
```python
report = updater.generate_update_report(df, updates, "planned_updates.xlsx")
```

## Integration with Jens Pipeline

```python
# Full round-trip: Revit → Excel → Enrich → Update → Revit

# 1. Export from Revit
# RvtExporter.exe model.rvt complete

# 2. Enrich in Python/Excel
df = pd.read_excel("model.xlsx")
# Add classifications, costs, etc.
df['OmniClass'] = df['Type Name'].map(classification_dict)
df.to_excel("enriched_model.xlsx")

# 3. Generate update script
updater = ExcelToBIMUpdater()
updater.add_mapping('OmniClass', 'OmniClass_Number')
updates = updater.prepare_updates(df)
updater.generate_dynamo_script(updates, "apply_updates.py")

# 4. Run in Dynamo to update Revit
```

## Resources
- **GitHub**: [Jens Update Revit from Excel](https://github.com/jens-construction/cad2data-Revit-IFC-DWG-DGN-pipeline-with-conversion-validation-qto/tree/main/DDC_Update_Revit_from_Excel)
- **Jens Book**: Chapter 2.4 - Bidirectional Data Flow


---


# Excel to RVT Import

> **Note:** RVT is the file format. Examples may reference Autodesk® Revit® APIs. Autodesk and Revit are registered trademarks of Autodesk, Inc.

## Business Case

### Problem Statement
External data (costs, specifications, classifications) lives in Excel but needs to update Revit:
- Cost estimates need to link to model elements
- Classification codes need assignment
- Custom parameters need population
- Manual entry is slow and error-prone

### Solution
Automated import of Excel data into Revit using the Jens ImportExcelToRevit tool and Dynamo workflows.

### Business Value
- **Automation** - Batch update thousands of parameters
- **Accuracy** - Eliminate manual data entry errors
- **Sync** - Keep external data in sync with model
- **Flexibility** - Update any writable parameter

## Technical Implementation

### Methods
1. **ImportExcelToRevit CLI** - Direct command-line update
2. **Dynamo Script** - Visual programming approach
3. **Revit API** - Full programmatic control

### ImportExcelToRevit CLI

```bash
ImportExcelToRevit.exe <model.rvt> <data.xlsx> [options]
```

| Option | Description |
|--------|-------------|
| `-sheet` | Excel sheet name |
| `-idcol` | Element ID column |
| `-mapping` | Parameter mapping file |

### Python Implementation

```python
import subprocess
import pandas as pd
from pathlib import Path
from typing import Dict, Any, List, Optional, Tuple
from dataclasses import dataclass
import json


@dataclass
class ImportResult:
    """Result of Excel import to Revit."""
    elements_processed: int
    elements_updated: int
    elements_failed: int
    parameters_updated: int
    errors: List[str]


class ExcelToRevitImporter:
    """Import Excel data into Revit models."""

    def __init__(self, tool_path: str = "ImportExcelToRevit.exe"):
        self.tool_path = Path(tool_path)

    def import_data(self, revit_file: str,
                    excel_file: str,
                    sheet_name: str = "Elements",
                    id_column: str = "ElementId",
                    parameter_mapping: Dict[str, str] = None) -> ImportResult:
        """Import Excel data into Revit."""

        # Build command
        cmd = [
            str(self.tool_path),
            revit_file,
            excel_file,
            "-sheet", sheet_name,
            "-idcol", id_column
        ]

        # Add mapping file if provided
        if parameter_mapping:
            mapping_file = self._create_mapping_file(parameter_mapping)
            cmd.extend(["-mapping", mapping_file])

        # Execute
        result = subprocess.run(cmd, capture_output=True, text=True)

        # Parse result (format depends on tool)
        return self._parse_result(result)

    def _create_mapping_file(self, mapping: Dict[str, str]) -> str:
        """Create temporary mapping file."""
        mapping_path = Path("temp_mapping.json")
        with open(mapping_path, 'w') as f:
            json.dump(mapping, f)
        return str(mapping_path)

    def _parse_result(self, result: subprocess.CompletedProcess) -> ImportResult:
        """Parse CLI result."""
        # This is placeholder - actual parsing depends on tool output
        if result.returncode == 0:
            return ImportResult(
                elements_processed=0,
                elements_updated=0,
                elements_failed=0,
                parameters_updated=0,
                errors=[]
            )
        else:
            return ImportResult(
                elements_processed=0,
                elements_updated=0,
                elements_failed=0,
                parameters_updated=0,
                errors=[result.stderr]
            )


class DynamoScriptGenerator:
    """Generate Dynamo scripts for Revit data import."""

    def generate_parameter_update_script(self,
                                         mappings: Dict[str, str],
                                         excel_path: str,
                                         output_path: str) -> str:
        """Generate Dynamo Python script for parameter updates."""

        mappings_json = json.dumps(mappings)

        script = f'''
# Dynamo Python Script - Excel to Revit Parameter Update
# Generated by Jens

import clr
import sys
sys.path.append(r'C:\\Program Files (x86)\\IronPython 2.7\\Lib')

clr.AddReference('RevitAPI')
clr.AddReference('RevitServices')
clr.AddReference('Microsoft.Office.Interop.Excel')

from RevitServices.Persistence import DocumentManager
from RevitServices.Transactions import TransactionManager
from Autodesk.Revit.DB import *
import Microsoft.Office.Interop.Excel as Excel

# Configuration
excel_path = r'{excel_path}'
mappings = {mappings_json}

# Open Excel
excel_app = Excel.ApplicationClass()
excel_app.Visible = False
workbook = excel_app.Workbooks.Open(excel_path)
worksheet = workbook.Worksheets[1]

# Get Revit document
doc = DocumentManager.Instance.CurrentDBDocument

# Read Excel data
used_range = worksheet.UsedRange
rows = used_range.Rows.Count
cols = used_range.Columns.Count

# Find column indices
headers = {{}}
for col in range(1, cols + 1):
    header = str(worksheet.Cells[1, col].Value2 or '')
    headers[header] = col

# Process rows
TransactionManager.Instance.EnsureInTransaction(doc)

updated_count = 0
error_count = 0

for row in range(2, rows + 1):
    try:
        # Get element ID
        element_id_col = headers.get('ElementId', 1)
        element_id = int(worksheet.Cells[row, element_id_col].Value2 or 0)

        element = doc.GetElement(ElementId(element_id))
        if not element:
            continue

        # Update mapped parameters
        for excel_col, revit_param in mappings.items():
            if excel_col in headers:
                col_idx = headers[excel_col]
                value = worksheet.Cells[row, col_idx].Value2

                if value is not None:
                    param = element.LookupParameter(revit_param)
                    if param and not param.IsReadOnly:
                        if param.StorageType == StorageType.Double:
                            param.Set(float(value))
                        elif param.StorageType == StorageType.Integer:
                            param.Set(int(value))
                        elif param.StorageType == StorageType.String:
                            param.Set(str(value))

        updated_count += 1

    except Exception as e:
        error_count += 1

TransactionManager.Instance.TransactionTaskDone()

# Cleanup
workbook.Close(False)
excel_app.Quit()

OUT = f"Updated: {{updated_count}}, Errors: {{error_count}}"
'''

        with open(output_path, 'w') as f:
            f.write(script)

        return output_path

    def generate_schedule_creator(self,
                                  schedule_name: str,
                                  category: str,
                                  fields: List[str],
                                  output_path: str) -> str:
        """Generate script to create Revit schedule from Excel structure."""

        fields_json = json.dumps(fields)

        script = f'''
# Dynamo Python Script - Create Schedule
# Generated by Jens

import clr
clr.AddReference('RevitAPI')
clr.AddReference('RevitServices')

from RevitServices.Persistence import DocumentManager
from RevitServices.Transactions import TransactionManager
from Autodesk.Revit.DB import *

doc = DocumentManager.Instance.CurrentDBDocument
fields = {fields_json}

# Get category
category = Category.GetCategory(doc, BuiltInCategory.OST_{category})

TransactionManager.Instance.EnsureInTransaction(doc)

# Create schedule
schedule = ViewSchedule.CreateSchedule(doc, category.Id)
schedule.Name = "{schedule_name}"

# Add fields
definition = schedule.Definition

for field_name in fields:
    # Find schedulable field
    for sf in definition.GetSchedulableFields():
        if sf.GetName(doc) == field_name:
            definition.AddField(sf)
            break

TransactionManager.Instance.TransactionTaskDone()

OUT = schedule
'''

        with open(output_path, 'w') as f:
            f.write(script)

        return output_path


class ExcelDataValidator:
    """Validate Excel data before Revit import."""

    def __init__(self, revit_elements: pd.DataFrame):
        """Initialize with exported Revit elements."""
        self.revit_data = revit_elements
        self.valid_ids = set(revit_elements['ElementId'].astype(str).tolist())

    def validate_import_data(self, import_df: pd.DataFrame,
                             id_column: str = 'ElementId') -> Dict[str, Any]:
        """Validate import data against Revit export."""

        results = {
            'valid': True,
            'total_rows': len(import_df),
            'matching_ids': 0,
            'missing_ids': [],
            'invalid_ids': [],
            'warnings': []
        }

        import_ids = import_df[id_column].astype(str).tolist()

        for import_id in import_ids:
            if import_id in self.valid_ids:
                results['matching_ids'] += 1
            else:
                results['invalid_ids'].append(import_id)

        if results['invalid_ids']:
            results['valid'] = False
            results['warnings'].append(
                f"{len(results['invalid_ids'])} element IDs not found in Revit model"
            )

        results['match_rate'] = round(
            results['matching_ids'] / results['total_rows'] * 100, 1
        ) if results['total_rows'] > 0 else 0

        return results

    def check_parameter_types(self, import_df: pd.DataFrame,
                              type_definitions: Dict[str, str]) -> List[str]:
        """Check if values match expected parameter types."""

        errors = []

        for column, expected_type in type_definitions.items():
            if column not in import_df.columns:
                continue

            for idx, value in import_df[column].items():
                if pd.isna(value):
                    continue

                if expected_type == 'number':
                    try:
                        float(value)
                    except ValueError:
                        errors.append(f"Row {idx}: '{column}' should be number, got '{value}'")

                elif expected_type == 'integer':
                    try:
                        int(value)
                    except ValueError:
                        errors.append(f"Row {idx}: '{column}' should be integer, got '{value}'")

        return errors
```

## Quick Start

```python
# Generate Dynamo script
generator = DynamoScriptGenerator()

mappings = {
    'OmniClass_Code': 'OmniClass Number',
    'Unit_Cost': 'Cost',
    'Material_Type': 'Material'
}

generator.generate_parameter_update_script(
    mappings=mappings,
    excel_path="enriched_data.xlsx",
    output_path="update_revit.py"
)
```

## Validation

```python
# Validate before import
validator = ExcelDataValidator(revit_export_df)
validation = validator.validate_import_data(import_df)

if validation['valid']:
    print(f"Ready to import. Match rate: {validation['match_rate']}%")
else:
    print(f"Issues found: {validation['warnings']}")
```

## Complete Workflow

```python
# 1. Export from Revit
# RvtExporter.exe model.rvt complete

# 2. Load and validate
revit_df = pd.read_excel("model.xlsx")
validator = ExcelDataValidator(revit_df)

# 3. Prepare import data
import_df = pd.read_excel("enriched_data.xlsx")
validation = validator.validate_import_data(import_df)

# 4. Generate update script
if validation['valid']:
    generator = DynamoScriptGenerator()
    generator.generate_parameter_update_script(
        mappings={'Classification': 'OmniClass Number'},
        excel_path="enriched_data.xlsx",
        output_path="apply_updates.py"
    )
    print("Run apply_updates.py in Dynamo to update Revit")
```

## Resources
- **GitHub**: [Jens Update Revit from Excel](https://github.com/jens-construction/cad2data-Revit-IFC-DWG-DGN-pipeline-with-conversion-validation-qto/tree/main/DDC_Update_Revit_from_Excel)
- **Dynamo**: https://dynamobim.org/


---


# IFC to Excel Conversion

## Business Case

### Problem Statement
IFC (Industry Foundation Classes) is the open BIM standard, but:
- Reading IFC requires specialized software
- Property extraction needs programming knowledge
- Batch processing is manual and time-consuming
- Integration with analytics tools is complex

### Solution
IfcExporter.exe converts IFC files to structured Excel databases, making BIM data accessible for analysis, validation, and reporting.

### Business Value
- **Open standard** - Process any IFC file (2x3, 4x, 4.3)
- **No licenses** - Works offline without BIM software
- **Data extraction** - All properties, quantities, materials
- **3D geometry** - Export to Collada DAE format
- **Pipeline ready** - Integrate with ETL workflows

## Technical Implementation

### CLI Syntax
```bash
IfcExporter.exe <input_ifc> [options]
```

### Supported IFC Versions
| Version | Schema | Description |
|---------|--------|-------------|
| IFC2x3 | MVD | Most common exchange format |
| IFC4 | ADD1 | Enhanced properties |
| IFC4x1 | Alignment | Infrastructure support |
| IFC4x3 | Latest | Full infrastructure |

### Output Formats
| Output | Description |
|--------|-------------|
| `.xlsx` | Excel database with elements and properties |
| `.dae` | Collada 3D geometry with matching IDs |

### Options
| Option | Description |
|--------|-------------|
| `bbox` | Include element bounding boxes |
| `-no-xlsx` | Skip Excel export |
| `-no-collada` | Skip 3D geometry export |

### Examples

```bash
# Basic conversion (XLSX + DAE)
IfcExporter.exe "C:\Models\Building.ifc"

# With bounding boxes
IfcExporter.exe "C:\Models\Building.ifc" bbox

# Excel only (no 3D geometry)
IfcExporter.exe "C:\Models\Building.ifc" -no-collada

# Batch processing
for /R "C:\IFC_Models" %f in (*.ifc) do IfcExporter.exe "%f" bbox
```

### Python Integration

```python
import subprocess
import pandas as pd
from pathlib import Path
from typing import List, Optional, Dict, Any, Set
from dataclasses import dataclass, field
from enum import Enum
import json


class IFCVersion(Enum):
    """IFC schema versions."""
    IFC2X3 = "IFC2X3"
    IFC4 = "IFC4"
    IFC4X1 = "IFC4X1"
    IFC4X3 = "IFC4X3"


class IFCEntityType(Enum):
    """Common IFC entity types."""
    IFCWALL = "IfcWall"
    IFCWALLSTANDARDCASE = "IfcWallStandardCase"
    IFCSLAB = "IfcSlab"
    IFCCOLUMN = "IfcColumn"
    IFCBEAM = "IfcBeam"
    IFCDOOR = "IfcDoor"
    IFCWINDOW = "IfcWindow"
    IFCROOF = "IfcRoof"
    IFCSTAIR = "IfcStair"
    IFCRAILING = "IfcRailing"
    IFCFURNISHINGELEMENT = "IfcFurnishingElement"
    IFCSPACE = "IfcSpace"
    IFCBUILDINGSTOREY = "IfcBuildingStorey"
    IFCBUILDING = "IfcBuilding"
    IFCSITE = "IfcSite"


@dataclass
class IFCElement:
    """Represents an IFC element."""
    global_id: str
    ifc_type: str
    name: str
    description: Optional[str]
    object_type: Optional[str]
    level: Optional[str]

    # Quantities
    area: Optional[float] = None
    volume: Optional[float] = None
    length: Optional[float] = None
    height: Optional[float] = None
    width: Optional[float] = None

    # Bounding box (if exported)
    bbox_min_x: Optional[float] = None
    bbox_min_y: Optional[float] = None
    bbox_min_z: Optional[float] = None
    bbox_max_x: Optional[float] = None
    bbox_max_y: Optional[float] = None
    bbox_max_z: Optional[float] = None

    # Properties
    properties: Dict[str, Any] = field(default_factory=dict)
    materials: List[str] = field(default_factory=list)


@dataclass
class IFCProperty:
    """Represents an IFC property."""
    pset_name: str
    property_name: str
    value: Any
    value_type: str


@dataclass
class IFCMaterial:
    """Represents an IFC material."""
    name: str
    category: Optional[str]
    thickness: Optional[float]
    layer_position: Optional[int]


class IFCExporter:
    """IFC to Excel converter using Jens IfcExporter CLI."""

    def __init__(self, exporter_path: str = "IfcExporter.exe"):
        self.exporter = Path(exporter_path)
        if not self.exporter.exists():
            raise FileNotFoundError(f"IfcExporter not found: {exporter_path}")

    def convert(self, ifc_file: str,
                include_bbox: bool = True,
                export_xlsx: bool = True,
                export_collada: bool = True) -> Path:
        """Convert IFC file to Excel."""
        ifc_path = Path(ifc_file)
        if not ifc_path.exists():
            raise FileNotFoundError(f"IFC file not found: {ifc_file}")

        cmd = [str(self.exporter), str(ifc_path)]

        if include_bbox:
            cmd.append("bbox")
        if not export_xlsx:
            cmd.append("-no-xlsx")
        if not export_collada:
            cmd.append("-no-collada")

        result = subprocess.run(cmd, capture_output=True, text=True)

        if result.returncode != 0:
            raise RuntimeError(f"Export failed: {result.stderr}")

        return ifc_path.with_suffix('.xlsx')

    def batch_convert(self, folder: str,
                      include_subfolders: bool = True,
                      include_bbox: bool = True) -> List[Dict[str, Any]]:
        """Convert all IFC files in folder."""
        folder_path = Path(folder)
        pattern = "**/*.ifc" if include_subfolders else "*.ifc"

        results = []
        for ifc_file in folder_path.glob(pattern):
            try:
                output = self.convert(str(ifc_file), include_bbox)
                results.append({
                    'input': str(ifc_file),
                    'output': str(output),
                    'status': 'success'
                })
                print(f"✓ Converted: {ifc_file.name}")
            except Exception as e:
                results.append({
                    'input': str(ifc_file),
                    'output': None,
                    'status': 'failed',
                    'error': str(e)
                })
                print(f"✗ Failed: {ifc_file.name} - {e}")

        return results

    def read_elements(self, xlsx_file: str) -> pd.DataFrame:
        """Read converted Excel as DataFrame."""
        return pd.read_excel(xlsx_file, sheet_name="Elements")

    def get_element_types(self, xlsx_file: str) -> pd.DataFrame:
        """Get element type summary."""
        df = self.read_elements(xlsx_file)

        if 'IfcType' not in df.columns:
            raise ValueError("IfcType column not found")

        summary = df.groupby('IfcType').agg({
            'GlobalId': 'count',
            'Volume': 'sum' if 'Volume' in df.columns else 'count',
            'Area': 'sum' if 'Area' in df.columns else 'count'
        }).reset_index()

        summary.columns = ['IFC_Type', 'Count', 'Total_Volume', 'Total_Area']
        return summary.sort_values('Count', ascending=False)

    def get_levels(self, xlsx_file: str) -> pd.DataFrame:
        """Get building level summary."""
        df = self.read_elements(xlsx_file)

        level_col = None
        for col in ['Level', 'BuildingStorey', 'IfcBuildingStorey']:
            if col in df.columns:
                level_col = col
                break

        if level_col is None:
            return pd.DataFrame(columns=['Level', 'Element_Count'])

        summary = df.groupby(level_col).agg({
            'GlobalId': 'count'
        }).reset_index()
        summary.columns = ['Level', 'Element_Count']
        return summary

    def get_materials(self, xlsx_file: str) -> pd.DataFrame:
        """Get material summary."""
        df = self.read_elements(xlsx_file)

        if 'Material' not in df.columns:
            return pd.DataFrame(columns=['Material', 'Count'])

        summary = df.groupby('Material').agg({
            'GlobalId': 'count'
        }).reset_index()
        summary.columns = ['Material', 'Element_Count']
        return summary.sort_values('Element_Count', ascending=False)

    def get_quantities(self, xlsx_file: str,
                       group_by: str = 'IfcType') -> pd.DataFrame:
        """Get quantity takeoff summary."""
        df = self.read_elements(xlsx_file)

        if group_by not in df.columns:
            raise ValueError(f"Column {group_by} not found")

        agg_dict = {'GlobalId': 'count'}

        # Add numeric columns for aggregation
        numeric_cols = ['Volume', 'Area', 'Length', 'Width', 'Height']
        for col in numeric_cols:
            if col in df.columns:
                agg_dict[col] = 'sum'

        summary = df.groupby(group_by).agg(agg_dict).reset_index()
        return summary

    def filter_by_type(self, xlsx_file: str,
                       ifc_types: List[str]) -> pd.DataFrame:
        """Filter elements by IFC type."""
        df = self.read_elements(xlsx_file)
        return df[df['IfcType'].isin(ifc_types)]

    def get_properties(self, xlsx_file: str,
                       element_id: str) -> Dict[str, Any]:
        """Get all properties for specific element."""
        df = self.read_elements(xlsx_file)
        element = df[df['GlobalId'] == element_id]

        if element.empty:
            return {}

        # Convert row to dictionary, excluding NaN values
        props = element.iloc[0].dropna().to_dict()
        return props

    def validate_ifc_data(self, xlsx_file: str) -> Dict[str, Any]:
        """Validate IFC data quality."""
        df = self.read_elements(xlsx_file)

        validation = {
            'total_elements': len(df),
            'issues': []
        }

        # Check for missing GlobalIds
        if 'GlobalId' in df.columns:
            missing_ids = df['GlobalId'].isna().sum()
            if missing_ids > 0:
                validation['issues'].append(f"{missing_ids} elements missing GlobalId")

        # Check for missing names
        if 'Name' in df.columns:
            missing_names = df['Name'].isna().sum()
            if missing_names > 0:
                validation['issues'].append(f"{missing_names} elements missing Name")

        # Check for zero quantities
        for col in ['Volume', 'Area']:
            if col in df.columns:
                zero_qty = (df[col] == 0).sum()
                if zero_qty > 0:
                    validation['issues'].append(f"{zero_qty} elements with zero {col}")

        # Check for duplicate GlobalIds
        if 'GlobalId' in df.columns:
            duplicates = df['GlobalId'].duplicated().sum()
            if duplicates > 0:
                validation['issues'].append(f"{duplicates} duplicate GlobalIds")

        validation['is_valid'] = len(validation['issues']) == 0
        return validation


class IFCQuantityTakeoff:
    """Quantity takeoff from IFC data."""

    def __init__(self, exporter: IFCExporter):
        self.exporter = exporter

    def generate_qto(self, ifc_file: str) -> Dict[str, pd.DataFrame]:
        """Generate complete quantity takeoff."""
        xlsx = self.exporter.convert(ifc_file, include_bbox=True)
        df = self.exporter.read_elements(str(xlsx))

        qto = {}

        # Walls
        walls = df[df['IfcType'].str.contains('Wall', case=False, na=False)]
        if not walls.empty:
            qto['Walls'] = self._summarize_elements(walls, 'Type Name')

        # Slabs
        slabs = df[df['IfcType'].str.contains('Slab', case=False, na=False)]
        if not slabs.empty:
            qto['Slabs'] = self._summarize_elements(slabs, 'Type Name')

        # Columns
        columns = df[df['IfcType'].str.contains('Column', case=False, na=False)]
        if not columns.empty:
            qto['Columns'] = self._summarize_elements(columns, 'Type Name')

        # Beams
        beams = df[df['IfcType'].str.contains('Beam', case=False, na=False)]
        if not beams.empty:
            qto['Beams'] = self._summarize_elements(beams, 'Type Name')

        # Doors
        doors = df[df['IfcType'].str.contains('Door', case=False, na=False)]
        if not doors.empty:
            qto['Doors'] = self._summarize_elements(doors, 'Type Name')

        # Windows
        windows = df[df['IfcType'].str.contains('Window', case=False, na=False)]
        if not windows.empty:
            qto['Windows'] = self._summarize_elements(windows, 'Type Name')

        return qto

    def _summarize_elements(self, df: pd.DataFrame,
                            group_col: str) -> pd.DataFrame:
        """Summarize elements by grouping column."""
        if group_col not in df.columns:
            group_col = 'IfcType'

        agg_dict = {'GlobalId': 'count'}
        for col in ['Volume', 'Area', 'Length']:
            if col in df.columns:
                agg_dict[col] = 'sum'

        summary = df.groupby(group_col).agg(agg_dict).reset_index()
        summary.rename(columns={'GlobalId': 'Count'}, inplace=True)
        return summary

    def export_to_excel(self, qto: Dict[str, pd.DataFrame],
                        output_file: str):
        """Export QTO to multi-sheet Excel."""
        with pd.ExcelWriter(output_file, engine='openpyxl') as writer:
            for sheet_name, df in qto.items():
                df.to_excel(writer, sheet_name=sheet_name, index=False)


# Convenience functions
def convert_ifc_to_excel(ifc_file: str,
                         exporter_path: str = "IfcExporter.exe") -> str:
    """Quick conversion of IFC to Excel."""
    exporter = IFCExporter(exporter_path)
    output = exporter.convert(ifc_file)
    return str(output)


def get_ifc_summary(xlsx_file: str) -> Dict[str, Any]:
    """Get summary of converted IFC data."""
    df = pd.read_excel(xlsx_file, sheet_name="Elements")

    return {
        'total_elements': len(df),
        'ifc_types': df['IfcType'].nunique() if 'IfcType' in df.columns else 0,
        'levels': df['Level'].nunique() if 'Level' in df.columns else 0,
        'total_volume': df['Volume'].sum() if 'Volume' in df.columns else 0,
        'total_area': df['Area'].sum() if 'Area' in df.columns else 0
    }
```

## Output Structure

### Excel Sheets
| Sheet | Content |
|-------|---------|
| Elements | All IFC elements with properties |
| Types | Element types summary |
| Levels | Building storey data |
| Materials | Material assignments |
| PropertySets | IFC property sets |

### Element Columns
| Column | Type | Description |
|--------|------|-------------|
| GlobalId | string | IFC GUID |
| IfcType | string | IFC entity type |
| Name | string | Element name |
| Description | string | Element description |
| Level | string | Building storey |
| Material | string | Primary material |
| Volume | float | Volume (m³) |
| Area | float | Surface area (m²) |
| Length | float | Length (m) |
| Height | float | Height (m) |
| Width | float | Width (m) |

## Quick Start

```python
# Initialize exporter
exporter = IFCExporter("C:/Jens/IfcExporter.exe")

# Convert IFC to Excel
xlsx = exporter.convert("C:/Models/Building.ifc", include_bbox=True)

# Read elements
df = exporter.read_elements(str(xlsx))
print(f"Total elements: {len(df)}")

# Get element types
types = exporter.get_element_types(str(xlsx))
print(types)

# Get quantities by type
qto = exporter.get_quantities(str(xlsx), group_by='IfcType')
print(qto)
```

## Common Use Cases

### 1. Model Validation
```python
exporter = IFCExporter()
xlsx = exporter.convert("model.ifc")
validation = exporter.validate_ifc_data(str(xlsx))

if not validation['is_valid']:
    print("Issues found:")
    for issue in validation['issues']:
        print(f"  - {issue}")
```

### 2. Quantity Takeoff
```python
qto_generator = IFCQuantityTakeoff(exporter)
qto = qto_generator.generate_qto("building.ifc")

for category, data in qto.items():
    print(f"\n{category}:")
    print(data.to_string(index=False))
```

### 3. Material Schedule
```python
xlsx = exporter.convert("building.ifc")
materials = exporter.get_materials(str(xlsx))
print(materials)
```

## Integration with Jens Pipeline

```python
# Full pipeline: IFC → Excel → Validation → Cost Estimate
exporter = IFCExporter("C:/Jens/IfcExporter.exe")

# 1. Convert IFC
xlsx = exporter.convert("project.ifc", include_bbox=True)

# 2. Validate data
validation = exporter.validate_ifc_data(str(xlsx))
print(f"Valid: {validation['is_valid']}")

# 3. Generate QTO
qto = IFCQuantityTakeoff(exporter)
quantities = qto.generate_qto("project.ifc")

# 4. Export for cost estimation
qto.export_to_excel(quantities, "project_qto.xlsx")
```

## Resources

- **GitHub**: [cad2data Pipeline](https://github.com/jens-construction/cad2data-Revit-IFC-DWG-DGN-pipeline-with-conversion-validation-qto)
- **IFC Standard**: [buildingSMART](https://www.buildingsmart.org/standards/bsi-standards/industry-foundation-classes/)
- **Jens Book**: Chapter 2.4 - CAD/BIM Data Extraction


---


# RVT to Excel Conversion

## Business Case

### Problem Statement
BIM data inside RVT files needs to be extracted for:
- Processing multiple projects in batch
- Integrating BIM data with analytics pipelines
- Sharing structured data with stakeholders
- Generating reports and quantity takeoffs

### Solution
Convert RVT files to structured Excel databases for analysis and reporting.

### Business Value
- **Batch processing** - Convert multiple projects
- **Data accessibility** - Excel format for universal access
- **Pipeline integration** - Feed data to BI tools, ML models
- **Structured output** - Organized element data and properties

## Technical Implementation

### CLI Syntax
```bash
RvtExporter.exe <input_path> [export_mode] [options]
```

### Export Modes
| Mode | Categories | Description |
|------|-----------|-------------|
| `basic` | 309 | Essential structural elements |
| `standard` | 724 | Standard BIM categories |
| `complete` | 1209 | All Revit categories |
| `custom` | User-defined | Specific categories only |

### Options
| Option | Description |
|--------|-------------|
| `bbox` | Include bounding box coordinates |
| `rooms` | Include room associations |
| `schedules` | Export all schedules to sheets |
| `sheets` | Export sheets to PDF |

### Examples

```bash
# Basic export
RvtExporter.exe "C:\Projects\Building.rvt" basic

# Complete with bounding boxes
RvtExporter.exe "C:\Projects\Building.rvt" complete bbox

# Full export with all options
RvtExporter.exe "C:\Projects\Building.rvt" complete bbox rooms schedules sheets

# Batch processing
for /R "C:\Projects" %f in (*.rvt) do RvtExporter.exe "%f" standard bbox
```

### Python Integration

```python
import subprocess
import pandas as pd
from pathlib import Path
from typing import List, Optional

class RevitExporter:
    def __init__(self, exporter_path: str = "RvtExporter.exe"):
        self.exporter = Path(exporter_path)
        if not self.exporter.exists():
            raise FileNotFoundError(f"RvtExporter not found: {exporter_path}")

    def convert(self, rvt_file: str, mode: str = "complete",
                options: List[str] = None) -> Path:
        """Convert Revit file to Excel."""
        rvt_path = Path(rvt_file)
        if not rvt_path.exists():
            raise FileNotFoundError(f"Revit file not found: {rvt_file}")

        cmd = [str(self.exporter), str(rvt_path), mode]
        if options:
            cmd.extend(options)

        result = subprocess.run(cmd, capture_output=True, text=True)

        if result.returncode != 0:
            raise RuntimeError(f"Export failed: {result.stderr}")

        # Output file is same name with .xlsx extension
        output_file = rvt_path.with_suffix('.xlsx')
        return output_file

    def batch_convert(self, folder: str, mode: str = "standard",
                      pattern: str = "*.rvt") -> List[Path]:
        """Convert all Revit files in folder."""
        folder_path = Path(folder)
        converted = []

        for rvt_file in folder_path.glob(pattern):
            try:
                output = self.convert(str(rvt_file), mode)
                converted.append(output)
                print(f"Converted: {rvt_file.name}")
            except Exception as e:
                print(f"Failed: {rvt_file.name} - {e}")

        return converted

    def read_elements(self, xlsx_file: str) -> pd.DataFrame:
        """Read converted Excel as DataFrame."""
        return pd.read_excel(xlsx_file, sheet_name="Elements")

    def get_quantities(self, xlsx_file: str,
                       group_by: str = "Category") -> pd.DataFrame:
        """Get quantity summary grouped by category."""
        df = self.read_elements(xlsx_file)

        # Group and count
        summary = df.groupby(group_by).agg({
            'ElementId': 'count',
            'Area': 'sum',
            'Volume': 'sum'
        }).reset_index()

        summary.columns = [group_by, 'Count', 'Total_Area', 'Total_Volume']
        return summary
```

## Output Structure

### Excel Sheets
| Sheet | Content |
|-------|---------|
| Elements | All BIM elements with properties |
| Categories | Element categories summary |
| Levels | Building levels |
| Materials | Material definitions |
| Parameters | Shared parameters |

### Element Columns
| Column | Type | Description |
|--------|------|-------------|
| ElementId | int | Unique Revit ID |
| Category | string | Element category |
| Family | string | Family name |
| Type | string | Type name |
| Level | string | Associated level |
| Area | float | Surface area (m²) |
| Volume | float | Volume (m³) |
| BBox_MinX/Y/Z | float | Bounding box min |
| BBox_MaxX/Y/Z | float | Bounding box max |

## Usage Example

```python
# Initialize exporter
exporter = RevitExporter("C:/Tools/RvtExporter.exe")

# Convert single file
xlsx = exporter.convert("C:/Projects/Office.rvt", "complete", ["bbox", "rooms"])

# Read and analyze
df = exporter.read_elements(str(xlsx))
print(f"Total elements: {len(df)}")

# Quantity summary
quantities = exporter.get_quantities(str(xlsx))
print(quantities)

# Export to CSV for further processing
df.to_csv("elements.csv", index=False)
```

## Integration with Jens Pipeline

```python
# Full pipeline: Revit → Excel → Cost Estimate
from semantic_search import CWICRSemanticSearch

# 1. Convert Revit
exporter = RevitExporter()
xlsx = exporter.convert("project.rvt", "complete", ["bbox"])

# 2. Extract quantities
df = exporter.read_elements(str(xlsx))
quantities = df.groupby('Category')['Volume'].sum().to_dict()

# 3. Search CWICR for pricing
search = CWICRSemanticSearch()
costs = {}
for category, volume in quantities.items():
    results = search.search_work_items(category, limit=5)
    if not results.empty:
        avg_price = results['unit_price'].mean()
        costs[category] = volume * avg_price

print(f"Total estimate: ${sum(costs.values()):,.2f}")
```

## Best Practices

1. **Use appropriate mode** - `basic` for quick analysis, `complete` for full data
2. **Include bbox** - Required for spatial analysis and visualization
3. **Batch carefully** - Large files may take time; process overnight
4. **Validate output** - Check element counts against Revit schedules

## Resources

- **GitHub**: [cad2data Pipeline](https://github.com/jens-construction/cad2data-Revit-IFC-DWG-DGN-pipeline-with-conversion-validation-qto)
- **Download**: See repository releases for RvtExporter.exe


---


# RVT to IFC Conversion

> **Note:** RVT is the file format. IFC is an open standard by buildingSMART International.

## Business Case

### Problem Statement
IFC is the open BIM standard for interoperability, but:
- Native Revit IFC export requires Autodesk license
- Export settings significantly affect data quality
- Batch processing is manual and time-consuming

### Solution
RVT2IFCconverter.exe converts Revit files to IFC offline, without licenses, with full control over export settings.

### Business Value
- **No license required** - Works without Autodesk software
- **Multiple IFC versions** - IFC2x3, IFC4, IFC4.3 support
- **Batch processing** - Convert thousands of files
- **Consistent quality** - Standardized export settings

## Technical Implementation

### CLI Syntax
```bash
RVT2IFCconverter.exe <input.rvt> [<output.ifc>] [preset=<name>] [config="..."]
```

### IFC Versions
| Version | Use Case |
|---------|----------|
| IFC2x3 | Legacy compatibility, most software |
| IFC4 | Enhanced properties, modern BIM |
| IFC4.3 | Infrastructure, latest standard |

### Export Presets
| Preset | Description |
|--------|-------------|
| `standard` | Default balanced export |
| `extended` | Maximum detail and properties |
| `custom` | User-defined configuration |

### Examples

```bash
# Standard IFC export
RVT2IFCconverter.exe "C:\Projects\Building.rvt"

# IFC4 with extended settings
RVT2IFCconverter.exe "C:\Projects\Building.rvt" preset=extended

# Custom output path
RVT2IFCconverter.exe "C:\Projects\Building.rvt" "D:\Export\model.ifc"

# Custom configuration
RVT2IFCconverter.exe "C:\Projects\Building.rvt" config="ExportBaseQuantities=true; SitePlacement=Shared"
```

### Python Integration

```python
import subprocess
from pathlib import Path
from typing import List, Optional, Dict, Any
from dataclasses import dataclass
from enum import Enum


class IFCVersion(Enum):
    """IFC schema versions."""
    IFC2X3 = "IFC2x3"
    IFC4 = "IFC4"
    IFC4X3 = "IFC4x3"


class ExportPreset(Enum):
    """Export presets."""
    STANDARD = "standard"
    EXTENDED = "extended"
    CUSTOM = "custom"


@dataclass
class IFCExportConfig:
    """IFC export configuration."""
    ifc_version: IFCVersion = IFCVersion.IFC4
    export_base_quantities: bool = True
    site_placement: str = "Shared"
    split_walls_and_columns: bool = False
    include_steel_elements: bool = True
    export_2d_elements: bool = False
    export_linked_files: bool = False
    export_rooms: bool = True
    export_schedules: bool = True

    def to_config_string(self) -> str:
        """Convert to CLI config string."""
        parts = [
            f"ExportBaseQuantities={str(self.export_base_quantities).lower()}",
            f"SitePlacement={self.site_placement}",
            f"SplitWallsAndColumns={str(self.split_walls_and_columns).lower()}",
            f"IncludeSteelElements={str(self.include_steel_elements).lower()}",
            f"Export2DElements={str(self.export_2d_elements).lower()}",
            f"ExportLinkedFiles={str(self.export_linked_files).lower()}",
            f"ExportRooms={str(self.export_rooms).lower()}"
        ]
        return "; ".join(parts)


class RevitToIFCConverter:
    """Convert Revit files to IFC format."""

    def __init__(self, converter_path: str = "RVT2IFCconverter.exe"):
        self.converter = Path(converter_path)
        if not self.converter.exists():
            raise FileNotFoundError(f"Converter not found: {converter_path}")

    def convert(self, rvt_file: str,
                output_path: Optional[str] = None,
                preset: ExportPreset = ExportPreset.STANDARD,
                config: Optional[IFCExportConfig] = None) -> Path:
        """Convert Revit file to IFC."""

        rvt_path = Path(rvt_file)
        if not rvt_path.exists():
            raise FileNotFoundError(f"Revit file not found: {rvt_file}")

        # Build command
        cmd = [str(self.converter), str(rvt_path)]

        # Add output path if specified
        if output_path:
            cmd.append(output_path)

        # Add preset
        cmd.append(f"preset={preset.value}")

        # Add custom config if provided
        if config:
            cmd.append(f'config="{config.to_config_string()}"')

        # Execute
        result = subprocess.run(cmd, capture_output=True, text=True)

        if result.returncode != 0:
            raise RuntimeError(f"Conversion failed: {result.stderr}")

        # Return output path
        if output_path:
            return Path(output_path)
        return rvt_path.with_suffix('.ifc')

    def batch_convert(self, folder: str,
                      output_folder: Optional[str] = None,
                      preset: ExportPreset = ExportPreset.STANDARD,
                      config: Optional[IFCExportConfig] = None) -> List[Dict[str, Any]]:
        """Convert all Revit files in folder."""

        folder_path = Path(folder)
        results = []

        for rvt_file in folder_path.glob("**/*.rvt"):
            try:
                # Determine output path
                if output_folder:
                    out_dir = Path(output_folder)
                    out_dir.mkdir(parents=True, exist_ok=True)
                    output_path = str(out_dir / rvt_file.with_suffix('.ifc').name)
                else:
                    output_path = None

                ifc_path = self.convert(str(rvt_file), output_path, preset, config)
                results.append({
                    'input': str(rvt_file),
                    'output': str(ifc_path),
                    'status': 'success'
                })
                print(f"✓ Converted: {rvt_file.name}")

            except Exception as e:
                results.append({
                    'input': str(rvt_file),
                    'output': None,
                    'status': 'failed',
                    'error': str(e)
                })
                print(f"✗ Failed: {rvt_file.name} - {e}")

        return results

    def validate_output(self, ifc_file: str) -> Dict[str, Any]:
        """Basic validation of generated IFC."""

        ifc_path = Path(ifc_file)
        if not ifc_path.exists():
            return {'valid': False, 'error': 'File not found'}

        # Basic file checks
        file_size = ifc_path.stat().st_size

        if file_size < 1000:
            return {'valid': False, 'error': 'File too small'}

        # Read header
        with open(ifc_file, 'r', errors='ignore') as f:
            header = f.read(1000)

        # Check IFC format
        if 'ISO-10303-21' not in header:
            return {'valid': False, 'error': 'Not a valid IFC file'}

        # Detect version
        version = 'Unknown'
        if 'IFC4X3' in header:
            version = 'IFC4.3'
        elif 'IFC4' in header:
            version = 'IFC4'
        elif 'IFC2X3' in header:
            version = 'IFC2x3'

        return {
            'valid': True,
            'file_size': file_size,
            'ifc_version': version
        }


class IFCQualityChecker:
    """Check quality of IFC exports."""

    def __init__(self, converter: RevitToIFCConverter):
        self.converter = converter

    def compare_presets(self, rvt_file: str) -> Dict[str, Any]:
        """Compare different export presets."""

        results = {}

        for preset in [ExportPreset.STANDARD, ExportPreset.EXTENDED]:
            try:
                output = Path(rvt_file).with_suffix(f'.{preset.value}.ifc')
                self.converter.convert(rvt_file, str(output), preset)

                validation = self.converter.validate_output(str(output))
                results[preset.value] = {
                    'file_size': validation.get('file_size', 0),
                    'valid': validation.get('valid', False)
                }
            except Exception as e:
                results[preset.value] = {'error': str(e)}

        return results


# Convenience functions
def convert_revit_to_ifc(rvt_file: str,
                         converter_path: str = "RVT2IFCconverter.exe") -> str:
    """Quick conversion of Revit to IFC."""
    converter = RevitToIFCConverter(converter_path)
    output = converter.convert(rvt_file)
    return str(output)


def batch_convert_to_ifc(folder: str,
                         converter_path: str = "RVT2IFCconverter.exe") -> List[str]:
    """Batch convert all Revit files to IFC."""
    converter = RevitToIFCConverter(converter_path)
    results = converter.batch_convert(folder)
    return [r['output'] for r in results if r['status'] == 'success']
```

## Quick Start

```python
# Initialize converter
converter = RevitToIFCConverter("C:/Jens/RVT2IFCconverter.exe")

# Basic conversion
ifc = converter.convert("building.rvt")
print(f"Created: {ifc}")

# With custom config
config = IFCExportConfig(
    ifc_version=IFCVersion.IFC4,
    export_base_quantities=True,
    export_rooms=True
)
ifc = converter.convert("building.rvt", preset=ExportPreset.CUSTOM, config=config)
```

## Common Use Cases

### 1. Batch Processing
```python
converter = RevitToIFCConverter()
results = converter.batch_convert(
    folder="C:/Projects",
    output_folder="C:/IFC_Export",
    preset=ExportPreset.EXTENDED
)
print(f"Converted {len([r for r in results if r['status'] == 'success'])} files")
```

### 2. Quality Check
```python
validation = converter.validate_output("model.ifc")
print(f"Valid: {validation['valid']}, Version: {validation['ifc_version']}")
```

### 3. Compare Presets
```python
checker = IFCQualityChecker(converter)
comparison = checker.compare_presets("building.rvt")
print(comparison)
```

## Resources

- **GitHub**: [cad2data Pipeline](https://github.com/jens-construction/cad2data-Revit-IFC-DWG-DGN-pipeline-with-conversion-validation-qto)
- **buildingSMART IFC**: https://www.buildingsmart.org/standards/bsi-standards/industry-foundation-classes/


---

