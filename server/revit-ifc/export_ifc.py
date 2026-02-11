# -*- coding: utf-8 -*-
"""
Jens Platform — pyRevit IFC Export Script
==========================================
Usage:  pyrevit run export_ifc.py <input.rvt> --revit=2023
        pyrevit run export_ifc.py <input.rvt> <output.ifc> --revit=2023

Requires:
  - Autodesk Revit 2023 (or matching --revit version)
  - revit-ifc plugin installed (Autodesk/revit-ifc)
  - pyRevit CLI (https://github.com/eirannejad/pyRevit)

The script reads optional params.json next to the input .rvt file
for export configuration (IFC version, base quantities, etc).
"""

import clr
import sys
import os
import json

# Revit API references (available in pyRevit IronPython context)
clr.AddReference('RevitAPI')
clr.AddReference('RevitAPIUI')
from Autodesk.Revit.DB import (
    IFCExportOptions,
    IFCVersion,
    Transaction,
)

# pyRevit provides __revit__ as the Revit Application object
doc = __revit__.ActiveUIDocument.Document

# --------------------------------------------------------------------------
# Parse arguments
# --------------------------------------------------------------------------

script_args = sys.argv[1:] if len(sys.argv) > 1 else []
input_path = None
output_path = None

for arg in script_args:
    if arg.startswith('--'):
        continue  # skip flags like --revit=2023
    elif input_path is None:
        input_path = arg
    elif output_path is None:
        output_path = arg

if not input_path:
    input_path = doc.PathName

# --------------------------------------------------------------------------
# Read params.json (created by revit-ifc-bridge.js)
# --------------------------------------------------------------------------

params = {}
if input_path:
    params_path = os.path.join(os.path.dirname(input_path), 'params.json')
    if os.path.exists(params_path):
        try:
            with open(params_path, 'r') as f:
                params = json.load(f)
        except Exception as e:
            print("WARN: Could not read params.json: {}".format(e))

# --------------------------------------------------------------------------
# IFC version mapping
# --------------------------------------------------------------------------

IFC_VERSIONS = {
    'IFC2x3': IFCVersion.IFC2x3CV2,
    'IFC4':   IFCVersion.IFC4,
}

version_key = params.get('ifcVersion', 'IFC4')
ifc_version = IFC_VERSIONS.get(version_key, IFCVersion.IFC4)

# --------------------------------------------------------------------------
# Export options
# --------------------------------------------------------------------------

options = IFCExportOptions()
options.FileVersion = ifc_version
options.WallAndColumnSplitting = params.get('wallSplitting', False)
options.ExportBaseQuantities = params.get('exportBaseQuantities', True)

# Additional IFC export settings
options.AddOption("ExportInternalRevitPropertySets", "true")
options.AddOption("ExportIFCCommonPropertySets", "true")
options.AddOption("SitePlacement", "0")  # shared coordinates

# --------------------------------------------------------------------------
# Determine output directory and filename
# --------------------------------------------------------------------------

output_dir = params.get('outputDir', os.path.dirname(input_path))
output_name = params.get(
    'outputName',
    os.path.splitext(os.path.basename(input_path))[0] + '.ifc'
)

if output_path:
    output_dir = os.path.dirname(output_path)
    output_name = os.path.basename(output_path)

# --------------------------------------------------------------------------
# Run IFC export
# --------------------------------------------------------------------------

print("EXPORT_START")
print("INPUT_PATH:" + (input_path or doc.PathName))
print("OUTPUT_DIR:" + output_dir)
print("OUTPUT_NAME:" + output_name)
print("IFC_VERSION:" + version_key)

try:
    with Transaction(doc, "Jens IFC Export") as t:
        t.Start()
        result = doc.Export(output_dir, output_name, options)
        t.RollBack()  # Do not save changes to the model

    full_output = os.path.join(output_dir, output_name)

    if result:
        print("EXPORT_RESULT:SUCCESS")
        print("OUTPUT_PATH:" + full_output)
    else:
        print("EXPORT_RESULT:FAILED")
        print("ERROR:Revit Document.Export() returned False")

except Exception as ex:
    print("EXPORT_RESULT:ERROR")
    print("ERROR:" + str(ex))
