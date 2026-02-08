# Jens Construction Skills

Adapted AI agent skills for construction project management, BIM analysis, cost estimation, and field operations.

## Available Skills

### CAD-Converters
Convert between CAD/BIM file formats. Includes batch processing, data extraction, and bidirectional workflows.
- **Batch CAD Converter** - Multi-format batch conversion (Revit, IFC, DWG, DGN) with progress tracking
- **DGN to Excel** - Convert MicroStation DGN files (V7/V8) to structured Excel databases
- **DWG to Excel** - Convert AutoCAD DWG files (1983-2026) to Excel without Autodesk licenses
- **Excel to BIM** - Push enriched Excel data back to BIM models (bidirectional workflow)
- **Excel to RVT** - Import Excel data into Revit projects via CLI or Dynamo scripts
- **IFC to Excel** - Convert IFC files (2x3, 4x1, 4x3) to Excel with properties and geometry
- **RVT to Excel** - Export Revit models to structured Excel databases
- **RVT to IFC** - Convert Revit files to IFC format (IFC2x3, IFC4, IFC4.3)

### Cost-Management
Manage project costs, budgets, cash flow, and payment applications.
- **BIM Cost Estimation (CWICR)** - Automated cost estimation from BIM models using the CWICR database
- **Budget Variance Analyzer** - Track and analyze budget variances with earned value metrics
- **Cash Flow Forecaster** - Forecast project cash flow based on schedule and cost data
- **Change Order Processor** - Process and track construction change orders
- **Material Delivery Tracker** - Track material deliveries and inventory
- **Payment Application Generator** - Generate AIA-style payment applications
- **Subcontractor Payment Tracker** - Track subcontractor invoices and payments

### CWICR-Database
Construction Work Items Cost Reference database operations with 55,719+ work items.
- **Assembly Builder** - Build composite assemblies from individual work items
- **Bid Analyzer** - Analyze bids against CWICR reference costs
- **Change Order** - Price change orders using CWICR rates
- **Comparison Tool** - Compare costs across regions and time periods
- **Cost Calculator** - Calculate costs for work items with quantity inputs
- **Crew Optimizer** - Optimize crew compositions for activities
- **Data Loader** - Load and parse CWICR CSV data
- **Data Validator** - Validate CWICR data integrity
- **Equipment Planner** - Plan equipment needs from work items
- **Escalation** - Apply cost escalation factors
- **Historical Cost** - Analyze historical cost trends
- **Labor Scheduler** - Schedule labor based on work items
- **Location Factor** - Apply geographic cost adjustment factors
- **Material Procurement** - Generate material procurement lists
- **Material Substitution** - Find alternative materials with cost impact
- **Multilingual** - Multi-language support for work item descriptions
- **Overhead & Markup** - Calculate overhead and markup rates
- **Productivity Tracker** - Track productivity against CWICR standards
- **Quantity Matcher** - Match BIM quantities to CWICR items
- **Rate Updater** - Update CWICR rates with current pricing
- **Report Generator** - Generate cost reports from CWICR data
- **Resource Analyzer** - Analyze resource requirements
- **Risk Calculator** - Calculate cost risk and contingency
- **Schedule Integrator** - Link CWICR items to schedule activities
- **Semantic Search** - Vector-based semantic search across work items
- **Subcontractor** - Manage subcontractor pricing against CWICR
- **Takeoff Helper** - Assist with quantity takeoff using CWICR
- **Unit Converter** - Convert units between measurement systems
- **Value Engineering** - Identify cost optimization opportunities
- **Waste Calculator** - Calculate material waste factors
- **Work Breakdown** - Create work breakdown structures from CWICR

### BIM-Analysis
Analyze BIM models for clashes, classification, validation, quantities, and progress.
- **BIM Clash Detection** - Detect geometric clashes between building systems (MEP, structural, architectural)
- **BIM Classification AI** - AI-powered classification mapping to UniFormat, MasterFormat, OmniClass, CWICR
- **BIM Validation Report** - Automated model validation against configurable quality rules
- **IFC QTO Extraction** - Extract quantities from IFC/Revit models for cost estimation
- **Progress Photo Analyzer** - Analyze site photos for progress tracking and safety detection

### Analytics
Track project performance with automated reporting and KPI dashboards.
- **Daily Progress Report** - Generate automated daily progress reports from site data
- **Productivity Analyzer** - Analyze labor productivity, identify trends, benchmark against standards
- **Project KPI Dashboard** - Interactive KPI dashboards for schedule, cost, quality, and safety metrics

### Document-Control
Manage construction documents, contracts, RFIs, submittals, and meeting minutes.
- **As-Built Documentation** - Track and manage as-built document packages
- **Contract Clause Analyzer** - AI-powered analysis of contract clauses and risk identification
- **Meeting Minutes Generator** - Automated meeting minutes from structured input
- **RFI Management** - Request for Information tracking and workflow
- **Submittal Tracker** - Track submittal packages through approval workflow

### Field-Operations
Support field activities with daily reports, photo analysis, punch lists, and safety inspections.
- **Daily Report Generator** - Generate daily construction reports with labor, equipment, weather
- **Progress Photo Analyzer** - Computer vision analysis of site photos
- **Punch List Manager** - Create and track punch list items through resolution
- **Safety Inspection** - Conduct and track safety inspections with automated scoring

### Schedule-Management
Manage construction schedules, critical path analysis, delay tracking, and BIM-to-schedule integration.
- **BIM to Schedule (4D)** - Link BIM elements to schedule activities for 4D simulation
- **Critical Path Analyzer** - Identify and analyze critical path activities
- **Schedule Delay Analyzer** - Analyze schedule delays and calculate impact
- **Schedule-Cost Link** - Link schedule activities to cost items for earned value
- **Weather Impact Scheduler** - Assess weather impact on schedule activities

### Resource-Management
Optimize labor, equipment, and material resources across projects.
- **Equipment Fleet Manager** - Track equipment fleet utilization, maintenance, and allocation
- **Labor Allocation** - Optimize labor allocation across activities and trades
- **Labor Productivity Analyzer** - Analyze labor productivity by trade and activity

### Procurement
Manage bids, materials, and subcontractor qualification.
- **Bid Analysis Comparator** - Compare and analyze competitive bids
- **Material Procurement Tracker** - Track material orders and deliveries
- **Material Tracker** - Monitor material inventory and usage
- **Subcontractor Prequalification** - Evaluate and qualify subcontractors

### Closeout
Manage project closeout, as-built tracking, warranty management, and punch lists.
- **As-Built Tracker** - Track as-built documentation completion
- **Warranty Tracker** - Manage warranty periods and claims
- **Project Closeout Checklist** - Comprehensive closeout checklist management
- **Punch List Manager** - Final punch list management and tracking

## Usage

Each category directory contains a consolidated `SKILL.md` file with:
- Business case and problem statements
- Python implementation code
- CLI command references
- Quick start examples
- Common use cases
- Integration patterns

## File Structure

```
skills/
  CAD-Converters/SKILL.md
  Cost-Management/SKILL.md
  CWICR-Database/SKILL.md
  BIM-Analysis/SKILL.md
  Analytics/SKILL.md
  Document-Control/SKILL.md
  Field-Operations/SKILL.md
  Schedule-Management/SKILL.md
  Resource-Management/SKILL.md
  Procurement/SKILL.md
  Closeout/SKILL.md
  README.md
```
