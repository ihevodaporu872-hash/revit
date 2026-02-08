# Field-Operations Skills

Consolidated skill reference for Field-Operations operations.

---

# Daily Report Generator for Construction Sites

Automate the creation of comprehensive daily construction reports by aggregating data from multiple sources into professional documentation.

## Business Case

**Problem**: Site managers spend 45-60 minutes daily on:
- Collecting information from foremen
- Checking weather conditions
- Compiling worker counts and hours
- Writing narrative summaries
- Formatting and distributing reports

**Solution**: Automated system that:
- Pulls data from Google Sheets/project database
- Integrates weather API data
- Aggregates worker timesheets
- Generates professional PDF reports
- Distributes to stakeholders automatically

**ROI**: 80% reduction in daily reporting time (45 min → 9 min for review)

## Report Structure

```
┌──────────────────────────────────────────────────────────────────────┐
│                    DAILY CONSTRUCTION REPORT                          │
│                                                                       │
│  Project: ЖК Солнечный, Корпус 2          Date: 24.01.2026           │
│  Report #: DCR-2026-024                   Weather: ☁️ -5°C           │
├──────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  1. WEATHER CONDITIONS                                                │
│  ┌────────────┬────────────┬────────────┬────────────┐               │
│  │ Morning    │ Afternoon  │ Evening    │ Impact     │               │
│  │ -8°C ☀️    │ -5°C ☁️    │ -7°C 🌙    │ Normal     │               │
│  └────────────┴────────────┴────────────┴────────────┘               │
│                                                                       │
│  2. WORKFORCE                                                         │
│  ┌────────────────────────────────────────────────────┐              │
│  │ Category          │ Planned │ Actual │ Hours      │              │
│  ├────────────────────────────────────────────────────┤              │
│  │ GC Supervision    │    3    │   3    │    27      │              │
│  │ Electrical        │   12    │  11    │    88      │              │
│  │ Plumbing          │    8    │   8    │    64      │              │
│  │ HVAC              │    6    │   6    │    48      │              │
│  │ TOTAL             │   29    │  28    │   227      │              │
│  └────────────────────────────────────────────────────┘              │
│                                                                       │
│  3. WORK COMPLETED TODAY                                              │
│  • Electrical: Completed rough-in floors 5-6                         │
│  • Plumbing: Installed risers section A                              │
│  • HVAC: Ductwork installation 60% complete                          │
│                                                                       │
│  4. WORK PLANNED FOR TOMORROW                                         │
│  • Electrical: Begin rough-in floor 7                                │
│  • Plumbing: Continue risers section B                               │
│  • HVAC: Complete ductwork, begin testing                            │
│                                                                       │
│  5. ISSUES / DELAYS                                                   │
│  • Material delay: Electrical panels (ETA: 26.01)                    │
│  • Weather: Expected snow may delay exterior work                    │
│                                                                       │
│  6. SAFETY                                                            │
│  ✅ No incidents                                                      │
│  ✅ Toolbox talk completed: Fall protection                          │
│                                                                       │
│  7. PHOTOS                                                            │
│  [Photo 1: Floor 5 electrical]  [Photo 2: Riser installation]        │
│                                                                       │
│  ─────────────────────────────────────────────────────────────────   │
│  Prepared by: Иван Петров, Site Manager                              │
│  Approved by: ___________________                                     │
│  Distribution: Owner, Architect, PM                                   │
└──────────────────────────────────────────────────────────────────────┘
```

## Python Implementation

```python
import pandas as pd
from datetime import datetime, date
from typing import Optional, List, Dict
import requests
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, Image
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm
import os

class DailyReportGenerator:
    """Generate professional daily construction reports"""

    def __init__(self, config: dict):
        self.config = config
        self.weather_api_key = config.get('weather_api_key')
        self.project_name = config.get('project_name')
        self.report_date = config.get('report_date', date.today())

    def get_weather_data(self, location: str) -> dict:
        """Fetch weather data from API"""
        if not self.weather_api_key:
            return self._mock_weather()

        url = f"https://api.openweathermap.org/data/2.5/weather"
        params = {
            'q': location,
            'appid': self.weather_api_key,
            'units': 'metric',
            'lang': 'ru'
        }

        response = requests.get(url, params=params)
        if response.status_code == 200:
            data = response.json()
            return {
                'temp': round(data['main']['temp']),
                'description': data['weather'][0]['description'],
                'humidity': data['main']['humidity'],
                'wind_speed': round(data['wind']['speed']),
                'icon': self._get_weather_icon(data['weather'][0]['main'])
            }
        return self._mock_weather()

    def _get_weather_icon(self, condition: str) -> str:
        icons = {
            'Clear': '☀️',
            'Clouds': '☁️',
            'Rain': '🌧️',
            'Snow': '❄️',
            'Thunderstorm': '⛈️',
            'Mist': '🌫️'
        }
        return icons.get(condition, '🌤️')

    def _mock_weather(self) -> dict:
        return {
            'temp': -5,
            'description': 'облачно',
            'humidity': 65,
            'wind_speed': 3,
            'icon': '☁️'
        }

    def get_workforce_data(self, source: pd.DataFrame) -> dict:
        """Aggregate workforce data from timesheet"""
        # Expected columns: trade, worker_name, hours_worked, planned_hours

        summary = source.groupby('trade').agg({
            'worker_name': 'count',
            'hours_worked': 'sum',
            'planned_hours': 'sum'
        }).reset_index()

        summary.columns = ['trade', 'actual_count', 'actual_hours', 'planned_hours']

        # Calculate planned count (assuming 8-hour shifts)
        summary['planned_count'] = (summary['planned_hours'] / 8).astype(int)

        return {
            'trades': summary.to_dict('records'),
            'total_workers': summary['actual_count'].sum(),
            'total_hours': summary['actual_hours'].sum(),
            'total_planned': summary['planned_count'].sum()
        }

    def get_work_completed(self, tasks: pd.DataFrame) -> List[dict]:
        """Extract completed work from task system"""
        # Filter completed tasks for today
        completed = tasks[
            (tasks['date'] == self.report_date.strftime('%d.%m.%Y')) &
            (tasks['status'].isin(['Completed', 'Partial']))
        ]

        work_items = []
        for _, row in completed.iterrows():
            work_items.append({
                'trade': row['trade'],
                'description': row['description'],
                'status': row['status'],
                'notes': row.get('notes', '')
            })

        return work_items

    def get_work_planned(self, tasks: pd.DataFrame) -> List[dict]:
        """Get planned work for tomorrow"""
        tomorrow = self.report_date + pd.Timedelta(days=1)

        planned = tasks[
            tasks['date'] == tomorrow.strftime('%d.%m.%Y')
        ]

        work_items = []
        for _, row in planned.iterrows():
            work_items.append({
                'trade': row['trade'],
                'description': row['description'],
                'priority': row.get('priority', 'Medium')
            })

        return work_items

    def get_issues(self, issues_log: pd.DataFrame) -> List[dict]:
        """Get active issues and delays"""
        active = issues_log[
            (issues_log['status'] == 'Open') |
            (issues_log['date_reported'] == self.report_date.strftime('%d.%m.%Y'))
        ]

        return active[['category', 'description', 'impact', 'resolution_date']].to_dict('records')

    def get_safety_data(self, safety_log: pd.DataFrame) -> dict:
        """Get safety information for the day"""
        today_incidents = safety_log[
            safety_log['date'] == self.report_date.strftime('%d.%m.%Y')
        ]

        return {
            'incidents': len(today_incidents[today_incidents['type'] == 'Incident']),
            'near_misses': len(today_incidents[today_incidents['type'] == 'Near Miss']),
            'toolbox_talk': today_incidents[
                today_incidents['type'] == 'Toolbox Talk'
            ]['topic'].tolist(),
            'observations': today_incidents[
                today_incidents['type'] == 'Observation'
            ]['description'].tolist()
        }

    def generate_report(self, data: dict, output_path: str) -> str:
        """Generate PDF report"""

        doc = SimpleDocTemplate(
            output_path,
            pagesize=A4,
            rightMargin=2*cm,
            leftMargin=2*cm,
            topMargin=2*cm,
            bottomMargin=2*cm
        )

        styles = getSampleStyleSheet()
        title_style = ParagraphStyle(
            'Title',
            parent=styles['Heading1'],
            fontSize=16,
            alignment=1,
            spaceAfter=12
        )
        heading_style = ParagraphStyle(
            'Heading',
            parent=styles['Heading2'],
            fontSize=12,
            spaceBefore=12,
            spaceAfter=6
        )

        elements = []

        # Title
        elements.append(Paragraph(
            f"DAILY CONSTRUCTION REPORT",
            title_style
        ))

        # Header info
        header_data = [
            ['Project:', self.project_name, 'Date:', self.report_date.strftime('%d.%m.%Y')],
            ['Report #:', data.get('report_number', 'DCR-001'), 'Weather:', f"{data['weather']['icon']} {data['weather']['temp']}°C"]
        ]
        header_table = Table(header_data, colWidths=[3*cm, 6*cm, 3*cm, 4*cm])
        header_table.setStyle(TableStyle([
            ('FONTNAME', (0, 0), (-1, -1), 'Helvetica'),
            ('FONTSIZE', (0, 0), (-1, -1), 10),
            ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
            ('FONTNAME', (2, 0), (2, -1), 'Helvetica-Bold'),
        ]))
        elements.append(header_table)
        elements.append(Spacer(1, 12))

        # Weather section
        elements.append(Paragraph("1. WEATHER CONDITIONS", heading_style))
        weather = data['weather']
        weather_text = f"""
        Temperature: {weather['temp']}°C | Humidity: {weather['humidity']}% |
        Wind: {weather['wind_speed']} m/s | Conditions: {weather['description']}
        """
        elements.append(Paragraph(weather_text, styles['Normal']))

        # Workforce section
        elements.append(Paragraph("2. WORKFORCE", heading_style))
        workforce = data['workforce']
        workforce_data = [['Trade', 'Planned', 'Actual', 'Hours']]
        for trade in workforce['trades']:
            workforce_data.append([
                trade['trade'],
                str(trade['planned_count']),
                str(trade['actual_count']),
                str(int(trade['actual_hours']))
            ])
        workforce_data.append([
            'TOTAL',
            str(workforce['total_planned']),
            str(workforce['total_workers']),
            str(int(workforce['total_hours']))
        ])

        workforce_table = Table(workforce_data, colWidths=[6*cm, 3*cm, 3*cm, 3*cm])
        workforce_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTNAME', (0, -1), (-1, -1), 'Helvetica-Bold'),
            ('GRID', (0, 0), (-1, -1), 1, colors.black),
            ('ALIGN', (1, 0), (-1, -1), 'CENTER'),
        ]))
        elements.append(workforce_table)

        # Work completed
        elements.append(Paragraph("3. WORK COMPLETED TODAY", heading_style))
        for item in data.get('work_completed', []):
            bullet = f"• {item['trade']}: {item['description']}"
            if item.get('notes'):
                bullet += f" ({item['notes']})"
            elements.append(Paragraph(bullet, styles['Normal']))

        # Work planned
        elements.append(Paragraph("4. WORK PLANNED FOR TOMORROW", heading_style))
        for item in data.get('work_planned', []):
            bullet = f"• {item['trade']}: {item['description']}"
            elements.append(Paragraph(bullet, styles['Normal']))

        # Issues
        elements.append(Paragraph("5. ISSUES / DELAYS", heading_style))
        issues = data.get('issues', [])
        if issues:
            for issue in issues:
                bullet = f"• {issue['category']}: {issue['description']}"
                if issue.get('resolution_date'):
                    bullet += f" (ETA: {issue['resolution_date']})"
                elements.append(Paragraph(bullet, styles['Normal']))
        else:
            elements.append(Paragraph("No significant issues reported.", styles['Normal']))

        # Safety
        elements.append(Paragraph("6. SAFETY", heading_style))
        safety = data.get('safety', {})
        if safety.get('incidents', 0) == 0:
            elements.append(Paragraph("✅ No incidents reported", styles['Normal']))
        else:
            elements.append(Paragraph(f"⚠️ {safety['incidents']} incident(s) reported", styles['Normal']))

        if safety.get('toolbox_talk'):
            elements.append(Paragraph(f"✅ Toolbox talk: {', '.join(safety['toolbox_talk'])}", styles['Normal']))

        # Signature block
        elements.append(Spacer(1, 24))
        elements.append(Paragraph("─" * 60, styles['Normal']))
        elements.append(Paragraph(f"Prepared by: {data.get('prepared_by', '_________________')}", styles['Normal']))
        elements.append(Paragraph(f"Date: {datetime.now().strftime('%d.%m.%Y %H:%M')}", styles['Normal']))

        # Build PDF
        doc.build(elements)
        return output_path


# Usage Example
def generate_daily_report(
    project_name: str,
    location: str,
    timesheet_path: str,
    tasks_path: str,
    output_dir: str
) -> str:
    """Generate daily report from source files"""

    # Initialize generator
    generator = DailyReportGenerator({
        'project_name': project_name,
        'weather_api_key': os.environ.get('WEATHER_API_KEY'),
        'report_date': date.today()
    })

    # Load data
    timesheet = pd.read_excel(timesheet_path)
    tasks = pd.read_excel(tasks_path)

    # Compile report data
    report_data = {
        'report_number': f"DCR-{date.today().strftime('%Y-%j')}",
        'weather': generator.get_weather_data(location),
        'workforce': generator.get_workforce_data(timesheet),
        'work_completed': generator.get_work_completed(tasks),
        'work_planned': generator.get_work_planned(tasks),
        'issues': [],  # Load from issues log if available
        'safety': {
            'incidents': 0,
            'toolbox_talk': ['Fall Protection'],
            'near_misses': 0
        },
        'prepared_by': 'Site Manager'
    }

    # Generate PDF
    output_path = os.path.join(
        output_dir,
        f"Daily_Report_{date.today().strftime('%Y%m%d')}.pdf"
    )

    return generator.generate_report(report_data, output_path)


if __name__ == "__main__":
    report_path = generate_daily_report(
        project_name="ЖК Солнечный, Корпус 2",
        location="Moscow,RU",
        timesheet_path="timesheet.xlsx",
        tasks_path="tasks.xlsx",
        output_dir="./reports"
    )
    print(f"Report generated: {report_path}")
```

## Data Sources Integration

### From n8n Project Management System
```python
# Connect to Google Sheets used by n8n bot
def get_data_from_project_management(spreadsheet_id: str) -> dict:
    """Pull data from n8n project management system"""
    import gspread

    gc = gspread.service_account()
    sh = gc.open_by_key(spreadsheet_id)

    # Get completed tasks
    tasks_sheet = sh.worksheet('Tasks')
    tasks = pd.DataFrame(tasks_sheet.get_all_records())

    # Get workforce from worker responses
    workers_sheet = sh.worksheet('Workers')
    workers = pd.DataFrame(workers_sheet.get_all_records())

    return {
        'tasks': tasks,
        'workers': workers
    }
```

### From Timesheet System
```python
# Integrate with common timesheet formats
def import_timesheet(source: str, format: str = 'excel') -> pd.DataFrame:
    """Import timesheet data from various sources"""

    if format == 'excel':
        df = pd.read_excel(source)
    elif format == 'csv':
        df = pd.read_csv(source)
    elif format == 'procore':
        df = fetch_procore_timesheet(source)

    # Standardize columns
    df = df.rename(columns={
        'Trade': 'trade',
        'Worker': 'worker_name',
        'Hours': 'hours_worked',
        'Planned Hours': 'planned_hours'
    })

    return df
```

## n8n Workflow for Automation

```yaml
name: Daily Report Automation
trigger:
  type: cron
  expression: "0 18 * * 1-6"  # 6 PM daily

steps:
  - collect_task_data:
      node: Google Sheets
      operation: readRows
      sheet: Tasks
      filter: Date = TODAY()

  - collect_timesheet:
      node: Google Sheets
      operation: readRows
      sheet: Timesheet
      filter: Date = TODAY()

  - get_weather:
      node: HTTP Request
      url: "https://api.openweathermap.org/data/2.5/weather"
      params:
        q: "Moscow,RU"
        appid: "{{$env.WEATHER_API_KEY}}"

  - generate_report:
      node: Code (Python)
      code: |
        from daily_report import generate_report
        return generate_report(items)

  - upload_to_drive:
      node: Google Drive
      operation: upload
      file: "={{$json.report_path}}"
      folder: "Daily Reports"

  - send_notification:
      node: Telegram
      operation: sendDocument
      chatId: "MANAGERS_GROUP_ID"
      document: "={{$json.drive_url}}"
      caption: |
        📋 Daily Report - {{$now.format('DD.MM.YYYY')}}

        Workforce: {{$json.total_workers}} workers
        Tasks completed: {{$json.completed_tasks}}
        Issues: {{$json.open_issues}}
```

## Report Distribution

```python
def distribute_report(report_path: str, recipients: dict):
    """Distribute report to stakeholders"""

    # Email distribution
    for email in recipients.get('email', []):
        send_email(
            to=email,
            subject=f"Daily Report - {date.today().strftime('%d.%m.%Y')}",
            body="Please find attached the daily construction report.",
            attachment=report_path
        )

    # Telegram distribution
    for chat_id in recipients.get('telegram', []):
        send_telegram_document(
            chat_id=chat_id,
            document_path=report_path,
            caption=f"📋 Daily Report - {date.today().strftime('%d.%m.%Y')}"
        )

    # Upload to project portal
    if portal_url := recipients.get('portal'):
        upload_to_portal(portal_url, report_path)
```

## Best Practices

1. **Data Collection**: Set up automated data collection to minimize manual input
2. **Review Time**: Allow 5-10 minutes for manager review before distribution
3. **Photos**: Include 3-5 key photos showing progress
4. **Issues**: Be specific about impacts and resolution dates
5. **Distribution**: Send by 6-7 PM to allow stakeholder review

---

*"A good daily report tells the story of the day in 2 minutes or less."*


---


# Field Progress Photo Analyzer

## Business Case

Site photos document progress but are often poorly organized. This skill provides systematic photo cataloging and analysis.

## Technical Implementation

```python
import pandas as pd
from datetime import datetime, date
from typing import Dict, Any, List, Optional
from dataclasses import dataclass, field
from enum import Enum


class PhotoCategory(Enum):
    PROGRESS = "progress"
    QUALITY = "quality"
    SAFETY = "safety"
    DELIVERY = "delivery"
    ISSUE = "issue"
    GENERAL = "general"


@dataclass
class SitePhoto:
    photo_id: str
    filename: str
    captured_date: datetime
    category: PhotoCategory
    location: str
    level: str
    zone: str
    captured_by: str
    description: str
    tags: List[str] = field(default_factory=list)
    activity_code: str = ""
    file_path: str = ""


class ProgressPhotoAnalyzer:
    def __init__(self, project_name: str):
        self.project_name = project_name
        self.photos: Dict[str, SitePhoto] = {}
        self._counter = 0

    def catalog_photo(self, filename: str, captured_date: datetime,
                     category: PhotoCategory, location: str, level: str,
                     captured_by: str, description: str = "",
                     zone: str = "", tags: List[str] = None) -> SitePhoto:
        self._counter += 1
        photo_id = f"PH-{self._counter:05d}"

        photo = SitePhoto(
            photo_id=photo_id,
            filename=filename,
            captured_date=captured_date,
            category=category,
            location=location,
            level=level,
            zone=zone,
            captured_by=captured_by,
            description=description,
            tags=tags or []
        )
        self.photos[photo_id] = photo
        return photo

    def get_photos_by_date(self, target_date: date) -> List[SitePhoto]:
        return [p for p in self.photos.values()
                if p.captured_date.date() == target_date]

    def get_photos_by_location(self, level: str, zone: str = None) -> List[SitePhoto]:
        photos = [p for p in self.photos.values() if p.level == level]
        if zone:
            photos = [p for p in photos if p.zone == zone]
        return photos

    def search_by_tag(self, tag: str) -> List[SitePhoto]:
        tag_lower = tag.lower()
        return [p for p in self.photos.values()
                if any(tag_lower in t.lower() for t in p.tags)]

    def get_summary(self) -> Dict[str, Any]:
        by_category = {}
        by_level = {}
        for p in self.photos.values():
            cat = p.category.value
            by_category[cat] = by_category.get(cat, 0) + 1
            by_level[p.level] = by_level.get(p.level, 0) + 1

        return {
            'total_photos': len(self.photos),
            'by_category': by_category,
            'by_level': by_level
        }

    def export_catalog(self, output_path: str):
        data = [{
            'ID': p.photo_id,
            'Filename': p.filename,
            'Date': p.captured_date,
            'Category': p.category.value,
            'Level': p.level,
            'Zone': p.zone,
            'Location': p.location,
            'By': p.captured_by,
            'Tags': ', '.join(p.tags)
        } for p in self.photos.values()]
        pd.DataFrame(data).to_excel(output_path, index=False)
```

## Quick Start

```python
analyzer = ProgressPhotoAnalyzer("Office Tower")

photo = analyzer.catalog_photo(
    filename="IMG_001.jpg",
    captured_date=datetime.now(),
    category=PhotoCategory.PROGRESS,
    location="Column Grid B-3",
    level="Level 5",
    captured_by="Site Super",
    tags=["concrete", "forming"]
)
```

## Resources
- **Jens Book**: Chapter 4.1 - Site Documentation


---


# Punch List Manager for Construction Closeout

Complete system for managing construction punch lists from creation through final acceptance.

## Business Case

**Problem**: Punch list management is inefficient:
- Paper lists get lost or outdated
- Difficult to track completion status
- Photos disconnected from items
- Back-charges delayed due to poor documentation
- Multiple walks create duplicate items

**Solution**: Digital punch list system that:
- Creates items with photos and location markup
- Assigns to responsible parties with deadlines
- Tracks completion with before/after photos
- Generates back-charge documentation
- Provides real-time completion dashboards

**ROI**: 50% faster closeout, 80% reduction in disputed back-charges

## Punch List Workflow

```
┌──────────────────────────────────────────────────────────────────────┐
│                      PUNCH LIST WORKFLOW                              │
├──────────────────────────────────────────────────────────────────────┤
│                                                                       │
│   CREATION            ASSIGNMENT          COMPLETION                 │
│   ┌─────────┐         ┌─────────┐         ┌─────────┐               │
│   │ Walk    │────────►│ Assign  │────────►│ Correct │               │
│   │ Site    │         │ Items   │         │ Items   │               │
│   └─────────┘         └─────────┘         └─────────┘               │
│       │                   │                   │                      │
│       ▼                   ▼                   ▼                      │
│   ┌─────────┐         ┌─────────┐         ┌─────────┐               │
│   │ Log     │         │ Notify  │         │ Submit  │               │
│   │ Items   │         │ Parties │         │ Photo   │               │
│   └─────────┘         └─────────┘         └─────────┘               │
│       │                   │                   │                      │
│       ▼                   ▼                   ▼                      │
│   ┌─────────┐         ┌─────────┐         ┌─────────┐               │
│   │ Photo   │         │ Set     │         │ Mark    │               │
│   │ + Tag   │         │ Deadline│         │ Complete│               │
│   └─────────┘         └─────────┘         └─────────┘               │
│                                               │                      │
│                                               ▼                      │
│   VERIFICATION        CLOSEOUT           ┌─────────┐               │
│   ┌─────────┐         ┌─────────┐        │ Verify  │               │
│   │ Re-walk │◄────────│ Accept  │◄───────│ Work    │               │
│   │ Site    │         │ Items   │        └─────────┘               │
│   └─────────┘         └─────────┘                                   │
│       │                   │                                          │
│       ▼                   ▼                                          │
│   ┌─────────┐         ┌─────────┐                                   │
│   │ New     │         │ Final   │                                   │
│   │ Items?  │────NO──►│ Accept  │                                   │
│   └────┬────┘         └─────────┘                                   │
│        │YES                                                          │
│        └──────────────► Back to CREATION                            │
│                                                                       │
└──────────────────────────────────────────────────────────────────────┘
```

## Data Structure

```python
from dataclasses import dataclass, field
from datetime import datetime, date
from enum import Enum
from typing import List, Optional
import uuid

class PunchItemStatus(Enum):
    OPEN = "Open"
    ASSIGNED = "Assigned"
    IN_PROGRESS = "In Progress"
    READY_FOR_VERIFICATION = "Ready for Verification"
    VERIFIED = "Verified"
    REJECTED = "Rejected"
    ACCEPTED = "Accepted"

class PunchItemPriority(Enum):
    CRITICAL = "Critical"     # Life safety / code compliance
    HIGH = "High"             # Affects occupancy
    MEDIUM = "Medium"         # Standard punch
    LOW = "Low"               # Minor / cosmetic
    OBSERVATION = "Observation"

class TradeCategory(Enum):
    GENERAL = "General Contractor"
    ELECTRICAL = "Electrical"
    PLUMBING = "Plumbing"
    HVAC = "HVAC"
    FIRE_PROTECTION = "Fire Protection"
    DRYWALL = "Drywall/Painting"
    FLOORING = "Flooring"
    MILLWORK = "Millwork/Casework"
    GLAZING = "Glazing"
    ROOFING = "Roofing"
    SITEWORK = "Sitework"
    LANDSCAPING = "Landscaping"
    CONTROLS = "Controls/BMS"
    OTHER = "Other"

@dataclass
class PunchItem:
    item_id: str
    punch_list_id: str
    description: str
    location: str
    trade: TradeCategory
    priority: PunchItemPriority

    # Location details
    building: str = ""
    floor: str = ""
    room: str = ""

    # Assignment
    assigned_to: str = ""
    assigned_date: date = None
    due_date: date = None

    # Documentation
    photo_before: str = ""
    photo_after: str = ""
    drawing_markup: str = ""
    spec_reference: str = ""

    # Status tracking
    status: PunchItemStatus = PunchItemStatus.OPEN
    created_by: str = ""
    created_date: date = field(default_factory=date.today)

    # Completion
    completed_by: str = ""
    completed_date: date = None
    completion_notes: str = ""

    # Verification
    verified_by: str = ""
    verified_date: date = None
    verification_notes: str = ""

    # Back-charge
    back_charge: bool = False
    back_charge_amount: float = 0.0
    back_charge_ref: str = ""

    # History
    history: List[dict] = field(default_factory=list)

@dataclass
class PunchList:
    list_id: str
    project_id: str
    name: str
    walk_date: date
    walk_attendees: List[str]

    items: List[PunchItem] = field(default_factory=list)
    status: str = "Active"  # Active, Complete
    created_by: str = ""
    created_date: date = field(default_factory=date.today)

    area: str = ""  # Building/floor/zone covered
    list_type: str = "Punch"  # Punch, Pre-Punch, Final
```

## Python Implementation

```python
import pandas as pd
from datetime import datetime, date, timedelta
from typing import List, Dict, Optional
from collections import defaultdict

class PunchListManager:
    """Construction punch list management system"""

    def __init__(self, project_id: str, storage_path: str = None):
        self.project_id = project_id
        self.storage_path = storage_path or f"punch_{project_id}"
        self.punch_lists: Dict[str, PunchList] = {}
        self.items: Dict[str, PunchItem] = {}

    def create_punch_list(
        self,
        name: str,
        walk_date: date,
        attendees: List[str],
        area: str = "",
        list_type: str = "Punch",
        created_by: str = ""
    ) -> PunchList:
        """Create new punch list from walk"""

        list_id = f"PL-{datetime.now().strftime('%Y%m%d%H%M%S')}"

        punch_list = PunchList(
            list_id=list_id,
            project_id=self.project_id,
            name=name,
            walk_date=walk_date,
            walk_attendees=attendees,
            area=area,
            list_type=list_type,
            created_by=created_by
        )

        self.punch_lists[list_id] = punch_list
        return punch_list

    def add_item(
        self,
        punch_list_id: str,
        description: str,
        location: str,
        trade: TradeCategory,
        priority: PunchItemPriority = PunchItemPriority.MEDIUM,
        building: str = "",
        floor: str = "",
        room: str = "",
        photo_before: str = "",
        drawing_markup: str = "",
        spec_reference: str = "",
        created_by: str = ""
    ) -> PunchItem:
        """Add item to punch list"""

        if punch_list_id not in self.punch_lists:
            raise ValueError(f"Punch list {punch_list_id} not found")

        # Generate item ID
        punch_list = self.punch_lists[punch_list_id]
        item_num = len(punch_list.items) + 1
        item_id = f"{punch_list_id}-{item_num:04d}"

        item = PunchItem(
            item_id=item_id,
            punch_list_id=punch_list_id,
            description=description,
            location=location,
            trade=trade,
            priority=priority,
            building=building,
            floor=floor,
            room=room,
            photo_before=photo_before,
            drawing_markup=drawing_markup,
            spec_reference=spec_reference,
            created_by=created_by
        )

        # Add history entry
        item.history.append({
            'date': datetime.now(),
            'action': 'Created',
            'by': created_by,
            'notes': ''
        })

        self.items[item_id] = item
        punch_list.items.append(item)

        return item

    def assign_item(
        self,
        item_id: str,
        assigned_to: str,
        due_date: date = None,
        assigned_by: str = ""
    ) -> PunchItem:
        """Assign item to responsible party"""

        item = self.items.get(item_id)
        if not item:
            raise ValueError(f"Item {item_id} not found")

        if due_date is None:
            # Default due dates by priority
            days = {
                PunchItemPriority.CRITICAL: 1,
                PunchItemPriority.HIGH: 3,
                PunchItemPriority.MEDIUM: 7,
                PunchItemPriority.LOW: 14,
                PunchItemPriority.OBSERVATION: 30
            }
            due_date = date.today() + timedelta(days=days.get(item.priority, 7))

        item.assigned_to = assigned_to
        item.assigned_date = date.today()
        item.due_date = due_date
        item.status = PunchItemStatus.ASSIGNED

        item.history.append({
            'date': datetime.now(),
            'action': 'Assigned',
            'by': assigned_by,
            'notes': f'Assigned to {assigned_to}, due {due_date}'
        })

        # Trigger notification
        self._notify_assignment(item)

        return item

    def mark_complete(
        self,
        item_id: str,
        completed_by: str,
        photo_after: str = "",
        completion_notes: str = ""
    ) -> PunchItem:
        """Mark item as completed by trade"""

        item = self.items.get(item_id)
        if not item:
            raise ValueError(f"Item {item_id} not found")

        item.completed_by = completed_by
        item.completed_date = date.today()
        item.photo_after = photo_after
        item.completion_notes = completion_notes
        item.status = PunchItemStatus.READY_FOR_VERIFICATION

        item.history.append({
            'date': datetime.now(),
            'action': 'Completed',
            'by': completed_by,
            'notes': completion_notes
        })

        return item

    def verify_item(
        self,
        item_id: str,
        verified_by: str,
        accepted: bool,
        notes: str = ""
    ) -> PunchItem:
        """Verify completed item"""

        item = self.items.get(item_id)
        if not item:
            raise ValueError(f"Item {item_id} not found")

        item.verified_by = verified_by
        item.verified_date = date.today()
        item.verification_notes = notes

        if accepted:
            item.status = PunchItemStatus.ACCEPTED
            action = 'Accepted'
        else:
            item.status = PunchItemStatus.REJECTED
            action = 'Rejected'
            # Re-assign for rework
            item.assigned_date = date.today()
            item.due_date = date.today() + timedelta(days=3)

        item.history.append({
            'date': datetime.now(),
            'action': action,
            'by': verified_by,
            'notes': notes
        })

        return item

    def add_back_charge(
        self,
        item_id: str,
        amount: float,
        reference: str = ""
    ) -> PunchItem:
        """Add back-charge to item"""

        item = self.items.get(item_id)
        if not item:
            raise ValueError(f"Item {item_id} not found")

        item.back_charge = True
        item.back_charge_amount = amount
        item.back_charge_ref = reference

        item.history.append({
            'date': datetime.now(),
            'action': 'Back Charge',
            'by': '',
            'notes': f'Amount: ${amount:.2f}, Ref: {reference}'
        })

        return item

    def get_items_by_trade(self, trade: TradeCategory) -> List[PunchItem]:
        """Get all items for a specific trade"""
        return [i for i in self.items.values() if i.trade == trade]

    def get_items_by_status(self, status: PunchItemStatus) -> List[PunchItem]:
        """Get items by status"""
        return [i for i in self.items.values() if i.status == status]

    def get_overdue_items(self) -> List[PunchItem]:
        """Get overdue items"""
        today = date.today()
        return [
            i for i in self.items.values()
            if i.status in [PunchItemStatus.OPEN, PunchItemStatus.ASSIGNED, PunchItemStatus.IN_PROGRESS]
            and i.due_date and i.due_date < today
        ]

    def get_statistics(self) -> dict:
        """Get punch list statistics"""

        all_items = list(self.items.values())
        if not all_items:
            return {'total': 0}

        by_status = defaultdict(int)
        by_trade = defaultdict(lambda: {'total': 0, 'open': 0})
        by_priority = defaultdict(int)

        for item in all_items:
            by_status[item.status.value] += 1
            by_trade[item.trade.value]['total'] += 1
            if item.status not in [PunchItemStatus.ACCEPTED, PunchItemStatus.VERIFIED]:
                by_trade[item.trade.value]['open'] += 1
            by_priority[item.priority.value] += 1

        # Calculate completion rate
        accepted = len([i for i in all_items if i.status == PunchItemStatus.ACCEPTED])
        completion_rate = accepted / len(all_items) * 100 if all_items else 0

        # Back charges
        back_charge_items = [i for i in all_items if i.back_charge]
        total_back_charges = sum(i.back_charge_amount for i in back_charge_items)

        return {
            'total': len(all_items),
            'by_status': dict(by_status),
            'by_trade': dict(by_trade),
            'by_priority': dict(by_priority),
            'completion_rate': round(completion_rate, 1),
            'overdue': len(self.get_overdue_items()),
            'back_charge_count': len(back_charge_items),
            'back_charge_total': total_back_charges
        }

    def generate_trade_report(self, trade: TradeCategory) -> str:
        """Generate report for specific trade"""

        items = self.get_items_by_trade(trade)

        report = f"""
╔══════════════════════════════════════════════════════════════╗
║           PUNCH LIST - {trade.value.upper():<30}      ║
║   Project: {self.project_id:<40}       ║
║   Date: {date.today().strftime('%d.%m.%Y'):<43}       ║
╠══════════════════════════════════════════════════════════════╣

Total Items: {len(items)}
Open: {len([i for i in items if i.status not in [PunchItemStatus.ACCEPTED]])}
Due Today: {len([i for i in items if i.due_date == date.today()])}
Overdue: {len([i for i in items if i.due_date and i.due_date < date.today() and i.status not in [PunchItemStatus.ACCEPTED]])}

ITEMS REQUIRING ACTION
───────────────────────────────────────────────────────────────
"""
        for item in items:
            if item.status not in [PunchItemStatus.ACCEPTED]:
                overdue_flag = "🔴" if item.due_date and item.due_date < date.today() else ""
                report += f"""
{overdue_flag} [{item.item_id}] {item.priority.value}
   Location: {item.location}
   Description: {item.description}
   Status: {item.status.value}
   Due: {item.due_date}
"""

        report += """
╚══════════════════════════════════════════════════════════════╝
"""
        return report

    def generate_summary_dashboard(self) -> str:
        """Generate overall punch list dashboard"""

        stats = self.get_statistics()

        report = f"""
╔══════════════════════════════════════════════════════════════════╗
║                    PUNCH LIST DASHBOARD                           ║
║   Project: {self.project_id:<40}          ║
║   Date: {date.today().strftime('%d.%m.%Y'):<43}          ║
╠══════════════════════════════════════════════════════════════════╣

📊 OVERALL STATUS
───────────────────────────────────────────────────────────────────
   Total Items:        {stats['total']}
   Completion Rate:    {stats['completion_rate']}%
   Overdue Items:      {stats['overdue']}

📈 BY STATUS
───────────────────────────────────────────────────────────────────
"""
        for status, count in stats['by_status'].items():
            bar = "█" * int(count / max(stats['by_status'].values()) * 20) if stats['by_status'] else ""
            report += f"   {status:<25} {count:>5}  {bar}\n"

        report += """
🔧 BY TRADE (Open Items)
───────────────────────────────────────────────────────────────────
"""
        for trade, data in sorted(stats['by_trade'].items(), key=lambda x: x[1]['open'], reverse=True):
            if data['open'] > 0:
                report += f"   {trade:<25} {data['open']:>5} open / {data['total']} total\n"

        report += f"""
💰 BACK CHARGES
───────────────────────────────────────────────────────────────────
   Items with Back Charges:  {stats['back_charge_count']}
   Total Back Charges:       ${stats['back_charge_total']:,.2f}

╚══════════════════════════════════════════════════════════════════╝
"""
        return report

    def _notify_assignment(self, item: PunchItem):
        """Send notification for assigned item"""
        print(f"📋 Punch item assigned: {item.item_id}")
        print(f"   To: {item.assigned_to}")
        print(f"   Due: {item.due_date}")
        print(f"   Location: {item.location}")

    def export_to_excel(self, output_path: str) -> str:
        """Export punch list to Excel"""

        records = []
        for item in self.items.values():
            records.append({
                'Item ID': item.item_id,
                'Description': item.description,
                'Location': item.location,
                'Building': item.building,
                'Floor': item.floor,
                'Room': item.room,
                'Trade': item.trade.value,
                'Priority': item.priority.value,
                'Status': item.status.value,
                'Assigned To': item.assigned_to,
                'Due Date': item.due_date,
                'Completed By': item.completed_by,
                'Completed Date': item.completed_date,
                'Back Charge': 'Yes' if item.back_charge else 'No',
                'Back Charge Amount': item.back_charge_amount if item.back_charge else '',
                'Photo Before': item.photo_before,
                'Photo After': item.photo_after
            })

        df = pd.DataFrame(records)
        df.to_excel(output_path, index=False)
        return output_path


# Usage Example
if __name__ == "__main__":
    # Initialize manager
    manager = PunchListManager(project_id="PROJECT-2026-001")

    # Create punch list from walk
    punch_list = manager.create_punch_list(
        name="Floor 5 Pre-Final Walk",
        walk_date=date.today(),
        attendees=["PM", "Architect", "GC Super"],
        area="Building A, Floor 5",
        list_type="Pre-Final",
        created_by="PM"
    )

    # Add items
    item1 = manager.add_item(
        punch_list_id=punch_list.list_id,
        description="Touch up paint at door frame Room 501",
        location="Room 501, door frame",
        trade=TradeCategory.DRYWALL,
        priority=PunchItemPriority.LOW,
        building="A",
        floor="5",
        room="501",
        created_by="PM"
    )

    item2 = manager.add_item(
        punch_list_id=punch_list.list_id,
        description="Missing cover plate on electrical outlet",
        location="Room 502, east wall",
        trade=TradeCategory.ELECTRICAL,
        priority=PunchItemPriority.MEDIUM,
        building="A",
        floor="5",
        room="502",
        created_by="PM"
    )

    # Assign items
    manager.assign_item(
        item_id=item1.item_id,
        assigned_to="ABC Painting",
        assigned_by="GC Super"
    )

    manager.assign_item(
        item_id=item2.item_id,
        assigned_to="XYZ Electric",
        due_date=date.today() + timedelta(days=2),
        assigned_by="GC Super"
    )

    # Mark complete
    manager.mark_complete(
        item_id=item1.item_id,
        completed_by="ABC Painting",
        completion_notes="Paint touched up"
    )

    # Verify
    manager.verify_item(
        item_id=item1.item_id,
        verified_by="PM",
        accepted=True,
        notes="Looks good"
    )

    # Generate reports
    print(manager.generate_summary_dashboard())
    print(manager.generate_trade_report(TradeCategory.ELECTRICAL))
```

## Telegram Bot Integration

```yaml
name: Punch List Bot
commands:
  /newitem:
    steps:
      - Ask: Photo of deficiency
      - Ask: Location (Building/Floor/Room)
      - Ask: Description
      - Ask: Trade (show buttons)
      - Ask: Priority (show buttons)
      - Confirm and create item

  /myitems:
    - Show open items assigned to user
    - Buttons: [Mark Complete] [View Details]

  /complete:
    - Select item from list
    - Ask for completion photo
    - Ask for notes
    - Submit for verification

  /dashboard:
    - Show summary statistics
    - Open items by trade
    - Overdue items
```

---

*"The last 10% of punch takes 50% of the time. Start early, stay organized."*


---


# Safety Inspection System for Construction

Comprehensive digital safety management system for construction sites with inspection checklists, hazard tracking, and incident reporting.

## Business Case

**Problem**: Paper-based safety management leads to:
- Incomplete inspections (20-30% of items skipped)
- Lost documentation
- Delayed incident reporting
- Difficulty tracking corrective actions
- Compliance audit failures

**Solution**: Digital system that:
- Enforces complete checklist completion
- Photos attached to each finding
- Instant notifications for hazards
- Tracks corrective actions to closure
- Generates compliance reports

**ROI**: 40% reduction in recordable incidents, 100% audit compliance

## Safety Inspection Types

```
┌──────────────────────────────────────────────────────────────────────┐
│                    SAFETY INSPECTION TYPES                            │
├──────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  DAILY                    WEEKLY                   SPECIAL           │
│  ┌─────────────┐          ┌─────────────┐         ┌─────────────┐   │
│  │ Pre-Work    │          │ Area Walk   │         │ Pre-Pour    │   │
│  │ • Housekeeping│        │ • Fire ext. │         │ • Formwork  │   │
│  │ • PPE       │          │ • First aid │         │ • Shoring   │   │
│  │ • Equipment │          │ • Scaffolds │         │ └─────────────┘   │
│  └─────────────┘          │ • Trenches  │         ┌─────────────┐   │
│  ┌─────────────┐          └─────────────┘         │ Crane Setup │   │
│  │ Toolbox Talk│          ┌─────────────┐         │ • Ground    │   │
│  │ • Topic     │          │ Equipment   │         │ • Load chart│   │
│  │ • Attendees │          │ • Cranes    │         │ • Rigging   │   │
│  │ • Sign-off  │          │ • Lifts     │         └─────────────┘   │
│  └─────────────┘          │ • Vehicles  │         ┌─────────────┐   │
│  ┌─────────────┐          └─────────────┘         │ Hot Work    │   │
│  │ End of Day  │                                  │ • Permit    │   │
│  │ • Secured   │                                  │ • Fire watch│   │
│  │ • Barricades│                                  └─────────────┘   │
│  └─────────────┘                                                     │
│                                                                       │
└──────────────────────────────────────────────────────────────────────┘
```

## Data Structure

```python
from dataclasses import dataclass, field
from datetime import datetime, date
from enum import Enum
from typing import List, Optional
import uuid

class HazardSeverity(Enum):
    CRITICAL = "Critical"      # Immediate danger to life
    HIGH = "High"              # Serious injury potential
    MEDIUM = "Medium"          # Injury potential
    LOW = "Low"                # Minor hazard
    OBSERVATION = "Observation"  # Best practice

class HazardStatus(Enum):
    OPEN = "Open"
    IN_PROGRESS = "In Progress"
    CORRECTED = "Corrected"
    VERIFIED = "Verified Closed"

class InspectionType(Enum):
    DAILY_PREWORK = "Daily Pre-Work"
    TOOLBOX_TALK = "Toolbox Talk"
    AREA_INSPECTION = "Area Inspection"
    EQUIPMENT_INSPECTION = "Equipment Inspection"
    HOT_WORK_PERMIT = "Hot Work Permit"
    CONFINED_SPACE = "Confined Space Entry"
    CRANE_LIFT = "Crane/Lift Inspection"
    SCAFFOLD = "Scaffold Inspection"
    EXCAVATION = "Excavation Inspection"
    INCIDENT = "Incident Report"

@dataclass
class Hazard:
    hazard_id: str
    inspection_id: str
    description: str
    severity: HazardSeverity
    location: str
    photo_urls: List[str] = field(default_factory=list)
    assigned_to: str = ""
    due_date: date = None
    status: HazardStatus = HazardStatus.OPEN
    corrective_action: str = ""
    corrected_date: date = None
    corrected_by: str = ""
    verification_date: date = None
    verified_by: str = ""

@dataclass
class Inspection:
    inspection_id: str
    inspection_type: InspectionType
    project_id: str
    date: date
    inspector: str
    location: str
    checklist_items: List[dict] = field(default_factory=list)
    hazards_found: List[Hazard] = field(default_factory=list)
    overall_rating: str = ""  # Pass/Fail/Conditional
    notes: str = ""
    photos: List[str] = field(default_factory=list)
    signatures: List[dict] = field(default_factory=list)
    weather: str = ""
    created_at: datetime = field(default_factory=datetime.now)

@dataclass
class Incident:
    incident_id: str
    project_id: str
    date: datetime
    type: str  # Near Miss, First Aid, Recordable, Lost Time
    description: str
    location: str
    injured_party: str = ""
    witness_names: List[str] = field(default_factory=list)
    immediate_actions: str = ""
    root_cause: str = ""
    corrective_actions: str = ""
    reported_by: str = ""
    photos: List[str] = field(default_factory=list)
    osha_recordable: bool = False
    days_away: int = 0
    days_restricted: int = 0
```

## Python Implementation

```python
import pandas as pd
from datetime import datetime, date, timedelta
from typing import List, Dict, Optional
import json
import os

class SafetyManager:
    """Construction site safety management system"""

    def __init__(self, project_id: str, storage_path: str = None):
        self.project_id = project_id
        self.storage_path = storage_path or f"safety_{project_id}"
        self.inspections: Dict[str, Inspection] = {}
        self.hazards: Dict[str, Hazard] = {}
        self.incidents: Dict[str, Incident] = {}

        # Load checklists
        self.checklists = self._load_checklists()

    def _load_checklists(self) -> Dict[str, List[dict]]:
        """Load inspection checklists"""
        return {
            InspectionType.DAILY_PREWORK.value: [
                {"id": "DP01", "item": "Work area clean and organized", "category": "Housekeeping"},
                {"id": "DP02", "item": "Walking surfaces clear of debris", "category": "Housekeeping"},
                {"id": "DP03", "item": "All workers have required PPE", "category": "PPE"},
                {"id": "DP04", "item": "Hard hats worn in designated areas", "category": "PPE"},
                {"id": "DP05", "item": "Safety glasses worn where required", "category": "PPE"},
                {"id": "DP06", "item": "High-visibility vests worn", "category": "PPE"},
                {"id": "DP07", "item": "Fall protection in use above 6 feet", "category": "Fall Protection"},
                {"id": "DP08", "item": "Guardrails/covers on floor openings", "category": "Fall Protection"},
                {"id": "DP09", "item": "Ladders in good condition", "category": "Equipment"},
                {"id": "DP10", "item": "Extension cords not damaged", "category": "Electrical"},
                {"id": "DP11", "item": "GFCIs in use for power tools", "category": "Electrical"},
                {"id": "DP12", "item": "Fire extinguishers accessible", "category": "Fire Safety"},
                {"id": "DP13", "item": "Emergency exits clear", "category": "Emergency"},
                {"id": "DP14", "item": "First aid kit stocked", "category": "Emergency"},
                {"id": "DP15", "item": "SDS sheets available", "category": "Hazcom"},
            ],
            InspectionType.SCAFFOLD.value: [
                {"id": "SC01", "item": "Base plates/mudsills in place", "category": "Foundation"},
                {"id": "SC02", "item": "All legs plumb and level", "category": "Structure"},
                {"id": "SC03", "item": "Cross bracing complete", "category": "Structure"},
                {"id": "SC04", "item": "Planking fully decked", "category": "Platform"},
                {"id": "SC05", "item": "No gaps >1 inch between planks", "category": "Platform"},
                {"id": "SC06", "item": "Guardrails at 42 inches", "category": "Guardrails"},
                {"id": "SC07", "item": "Midrails at 21 inches", "category": "Guardrails"},
                {"id": "SC08", "item": "Toeboards installed", "category": "Guardrails"},
                {"id": "SC09", "item": "Access ladder provided", "category": "Access"},
                {"id": "SC10", "item": "Tied to structure every 26 feet vertical", "category": "Ties"},
                {"id": "SC11", "item": "Inspection tag current", "category": "Documentation"},
                {"id": "SC12", "item": "Competent person inspection today", "category": "Documentation"},
            ],
            InspectionType.EXCAVATION.value: [
                {"id": "EX01", "item": "Excavation permit obtained", "category": "Permits"},
                {"id": "EX02", "item": "Utilities located and marked", "category": "Utilities"},
                {"id": "EX03", "item": "Competent person on site", "category": "Supervision"},
                {"id": "EX04", "item": "Soil classification completed", "category": "Soil"},
                {"id": "EX05", "item": "Appropriate protective system in place", "category": "Protection"},
                {"id": "EX06", "item": "Spoil pile 2+ feet from edge", "category": "Housekeeping"},
                {"id": "EX07", "item": "Ladder within 25 feet of workers", "category": "Egress"},
                {"id": "EX08", "item": "Barricades around excavation", "category": "Protection"},
                {"id": "EX09", "item": "Water accumulation addressed", "category": "Conditions"},
                {"id": "EX10", "item": "Atmosphere tested if >4 feet", "category": "Air Quality"},
            ],
        }

    def create_inspection(
        self,
        inspection_type: InspectionType,
        inspector: str,
        location: str,
        weather: str = ""
    ) -> Inspection:
        """Create new inspection"""

        inspection_id = f"INS-{datetime.now().strftime('%Y%m%d%H%M%S')}"

        # Get checklist for this type
        checklist = self.checklists.get(inspection_type.value, [])
        checklist_items = [
            {**item, "result": None, "notes": "", "photo": None}
            for item in checklist
        ]

        inspection = Inspection(
            inspection_id=inspection_id,
            inspection_type=inspection_type,
            project_id=self.project_id,
            date=date.today(),
            inspector=inspector,
            location=location,
            checklist_items=checklist_items,
            weather=weather
        )

        self.inspections[inspection_id] = inspection
        return inspection

    def complete_checklist_item(
        self,
        inspection_id: str,
        item_id: str,
        result: str,  # "Pass", "Fail", "N/A"
        notes: str = "",
        photo_url: str = None
    ) -> Inspection:
        """Complete a checklist item"""

        inspection = self.inspections.get(inspection_id)
        if not inspection:
            raise ValueError(f"Inspection {inspection_id} not found")

        for item in inspection.checklist_items:
            if item["id"] == item_id:
                item["result"] = result
                item["notes"] = notes
                item["photo"] = photo_url
                break

        # If failed, prompt for hazard creation
        if result == "Fail":
            print(f"⚠️ Item {item_id} failed - create hazard record")

        return inspection

    def add_hazard(
        self,
        inspection_id: str,
        description: str,
        severity: HazardSeverity,
        location: str,
        assigned_to: str = "",
        due_date: date = None,
        photo_urls: List[str] = None
    ) -> Hazard:
        """Record a hazard finding"""

        hazard_id = f"HAZ-{datetime.now().strftime('%Y%m%d%H%M%S')}"

        if due_date is None:
            # Default due dates by severity
            days = {
                HazardSeverity.CRITICAL: 0,    # Immediate
                HazardSeverity.HIGH: 1,        # 24 hours
                HazardSeverity.MEDIUM: 3,      # 3 days
                HazardSeverity.LOW: 7,         # 1 week
                HazardSeverity.OBSERVATION: 14 # 2 weeks
            }
            due_date = date.today() + timedelta(days=days.get(severity, 7))

        hazard = Hazard(
            hazard_id=hazard_id,
            inspection_id=inspection_id,
            description=description,
            severity=severity,
            location=location,
            assigned_to=assigned_to,
            due_date=due_date,
            photo_urls=photo_urls or []
        )

        self.hazards[hazard_id] = hazard

        # Add to inspection
        if inspection_id in self.inspections:
            self.inspections[inspection_id].hazards_found.append(hazard)

        # Notify for critical/high severity
        if severity in [HazardSeverity.CRITICAL, HazardSeverity.HIGH]:
            self._notify_hazard(hazard)

        return hazard

    def correct_hazard(
        self,
        hazard_id: str,
        corrective_action: str,
        corrected_by: str,
        photo_url: str = None
    ) -> Hazard:
        """Record hazard correction"""

        hazard = self.hazards.get(hazard_id)
        if not hazard:
            raise ValueError(f"Hazard {hazard_id} not found")

        hazard.corrective_action = corrective_action
        hazard.corrected_by = corrected_by
        hazard.corrected_date = date.today()
        hazard.status = HazardStatus.CORRECTED

        if photo_url:
            hazard.photo_urls.append(photo_url)

        return hazard

    def verify_hazard_closure(
        self,
        hazard_id: str,
        verified_by: str
    ) -> Hazard:
        """Verify hazard has been properly corrected"""

        hazard = self.hazards.get(hazard_id)
        if not hazard:
            raise ValueError(f"Hazard {hazard_id} not found")

        if hazard.status != HazardStatus.CORRECTED:
            raise ValueError(f"Hazard {hazard_id} not corrected yet")

        hazard.verified_by = verified_by
        hazard.verification_date = date.today()
        hazard.status = HazardStatus.VERIFIED

        return hazard

    def report_incident(
        self,
        incident_type: str,
        description: str,
        location: str,
        injured_party: str = "",
        witness_names: List[str] = None,
        immediate_actions: str = "",
        reported_by: str = "",
        photo_urls: List[str] = None
    ) -> Incident:
        """Report safety incident"""

        incident_id = f"INC-{datetime.now().strftime('%Y%m%d%H%M%S')}"

        incident = Incident(
            incident_id=incident_id,
            project_id=self.project_id,
            date=datetime.now(),
            type=incident_type,
            description=description,
            location=location,
            injured_party=injured_party,
            witness_names=witness_names or [],
            immediate_actions=immediate_actions,
            reported_by=reported_by,
            photos=photo_urls or []
        )

        self.incidents[incident_id] = incident

        # Immediate notification for all incidents
        self._notify_incident(incident)

        return incident

    def get_open_hazards(self) -> List[Hazard]:
        """Get all open hazards"""
        return [
            h for h in self.hazards.values()
            if h.status in [HazardStatus.OPEN, HazardStatus.IN_PROGRESS]
        ]

    def get_overdue_hazards(self) -> List[Hazard]:
        """Get overdue hazards"""
        today = date.today()
        return [
            h for h in self.hazards.values()
            if h.status == HazardStatus.OPEN and h.due_date < today
        ]

    def get_statistics(self, period_days: int = 30) -> dict:
        """Get safety statistics"""

        cutoff = date.today() - timedelta(days=period_days)

        # Filter by period
        period_inspections = [
            i for i in self.inspections.values()
            if i.date >= cutoff
        ]
        period_hazards = [
            h for h in self.hazards.values()
            # Get creation date from inspection
        ]
        period_incidents = [
            i for i in self.incidents.values()
            if i.date.date() >= cutoff
        ]

        # Calculate metrics
        total_inspections = len(period_inspections)
        total_hazards = len(self.hazards)
        open_hazards = len(self.get_open_hazards())
        overdue_hazards = len(self.get_overdue_hazards())

        # Incident metrics
        near_misses = len([i for i in period_incidents if i.type == "Near Miss"])
        first_aid = len([i for i in period_incidents if i.type == "First Aid"])
        recordables = len([i for i in period_incidents if i.osha_recordable])

        # Calculate TRIR (Total Recordable Incident Rate)
        # TRIR = (Recordables × 200,000) / Total Hours Worked
        # Assuming 50 workers × 8 hours × 22 days = 8,800 hours/month
        estimated_hours = 8800 * (period_days / 30)
        trir = (recordables * 200000 / estimated_hours) if estimated_hours > 0 else 0

        return {
            'period_days': period_days,
            'inspections_completed': total_inspections,
            'hazards_identified': total_hazards,
            'hazards_open': open_hazards,
            'hazards_overdue': overdue_hazards,
            'hazards_by_severity': self._count_by_severity(),
            'incidents_total': len(period_incidents),
            'near_misses': near_misses,
            'first_aid': first_aid,
            'recordables': recordables,
            'trir': round(trir, 2),
            'days_since_last_recordable': self._days_since_recordable()
        }

    def _count_by_severity(self) -> dict:
        """Count hazards by severity"""
        result = {s.value: 0 for s in HazardSeverity}
        for hazard in self.hazards.values():
            if hazard.status != HazardStatus.VERIFIED:
                result[hazard.severity.value] += 1
        return result

    def _days_since_recordable(self) -> int:
        """Calculate days since last recordable incident"""
        recordables = [
            i for i in self.incidents.values()
            if i.osha_recordable
        ]
        if not recordables:
            return 365  # Assume 1 year if no recordables

        last = max(recordables, key=lambda x: x.date)
        return (datetime.now() - last.date).days

    def _notify_hazard(self, hazard: Hazard):
        """Send notification for high-severity hazard"""
        print(f"🚨 HAZARD ALERT: {hazard.severity.value}")
        print(f"   Location: {hazard.location}")
        print(f"   Description: {hazard.description}")
        print(f"   Assigned to: {hazard.assigned_to}")
        print(f"   Due: {hazard.due_date}")

    def _notify_incident(self, incident: Incident):
        """Send notification for incident"""
        print(f"⚠️ INCIDENT REPORTED: {incident.type}")
        print(f"   Location: {incident.location}")
        print(f"   Description: {incident.description}")
        if incident.injured_party:
            print(f"   Injured: {incident.injured_party}")

    def generate_daily_safety_report(self) -> str:
        """Generate daily safety briefing"""

        stats = self.get_statistics(period_days=1)
        open_hazards = self.get_open_hazards()
        overdue = self.get_overdue_hazards()

        report = f"""
╔══════════════════════════════════════════════════════════════╗
║                   DAILY SAFETY BRIEFING                       ║
║   Project: {self.project_id:<40}       ║
║   Date: {date.today().strftime('%d.%m.%Y'):<43}       ║
╠══════════════════════════════════════════════════════════════╣

📊 TODAY'S METRICS
───────────────────────────────────────────────────────────────
   Days Without Recordable Incident: {stats['days_since_last_recordable']}
   Open Hazards: {stats['hazards_open']}
   Overdue Hazards: {stats['hazards_overdue']}

⚠️ OPEN HAZARDS REQUIRING ATTENTION
───────────────────────────────────────────────────────────────
"""
        if overdue:
            report += "🔴 OVERDUE:\n"
            for h in overdue:
                report += f"   • {h.hazard_id}: {h.description[:50]}... (Due: {h.due_date})\n"

        critical_high = [h for h in open_hazards
                        if h.severity in [HazardSeverity.CRITICAL, HazardSeverity.HIGH]]
        if critical_high:
            report += "\n🟠 CRITICAL/HIGH PRIORITY:\n"
            for h in critical_high:
                report += f"   • {h.hazard_id}: {h.description[:50]}... ({h.severity.value})\n"

        report += """
📋 REQUIRED INSPECTIONS TODAY
───────────────────────────────────────────────────────────────
   ☐ Pre-work safety inspection
   ☐ Toolbox talk (Topic: ________________)
   ☐ Equipment inspections

💡 SAFETY FOCUS OF THE DAY
───────────────────────────────────────────────────────────────
   [Insert daily focus topic]

╚══════════════════════════════════════════════════════════════╝
"""
        return report


# Usage Example
if __name__ == "__main__":
    # Initialize safety manager
    safety = SafetyManager(project_id="PROJECT-2026-001")

    # Create daily pre-work inspection
    inspection = safety.create_inspection(
        inspection_type=InspectionType.DAILY_PREWORK,
        inspector="Ivan Petrov",
        location="Building A, Floor 5",
        weather="Clear, -5°C"
    )

    print(f"Created inspection: {inspection.inspection_id}")

    # Complete checklist items
    safety.complete_checklist_item(
        inspection_id=inspection.inspection_id,
        item_id="DP01",
        result="Pass"
    )

    safety.complete_checklist_item(
        inspection_id=inspection.inspection_id,
        item_id="DP07",
        result="Fail",
        notes="Worker on scaffold without harness"
    )

    # Add hazard for failed item
    hazard = safety.add_hazard(
        inspection_id=inspection.inspection_id,
        description="Worker observed on scaffold without fall protection harness",
        severity=HazardSeverity.CRITICAL,
        location="Building A, Floor 5, West side",
        assigned_to="Site Foreman"
    )

    print(f"Hazard created: {hazard.hazard_id}")

    # Correct hazard
    safety.correct_hazard(
        hazard_id=hazard.hazard_id,
        corrective_action="Worker provided harness and retrained on fall protection requirements",
        corrected_by="Ivan Petrov"
    )

    # Verify closure
    safety.verify_hazard_closure(
        hazard_id=hazard.hazard_id,
        verified_by="Safety Manager"
    )

    # Generate daily report
    print(safety.generate_daily_safety_report())
```

## Mobile App Integration

```yaml
# Telegram bot for field safety inspections
name: Safety Inspection Bot
commands:
  /inspection:
    - Select inspection type
    - Show checklist
    - Record results (✅/❌)
    - Capture photos
    - Submit

  /hazard:
    - Describe hazard
    - Select severity
    - Take photo
    - GPS location
    - Assign responsible party

  /incident:
    - Report type
    - Description
    - Photos
    - Witness info
    - Immediate actions
```

---

*"Safety is not a priority - it's a value. Priorities change, values don't."*


---

