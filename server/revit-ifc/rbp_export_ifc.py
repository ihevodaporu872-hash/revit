# -*- coding: utf-8 -*-
"""
Jens Platform — RevitBatchProcessor (RBP) IFC Export Script
============================================================
Usage:  BatchRvt.exe --settings_file batch_settings.json

This script is executed by RevitBatchProcessor (BatchRvt).
It uses a different API than pyRevit to access the Revit document.

Requires:
  - Autodesk Revit 2023
  - RevitBatchProcessor (https://github.com/bvn-architecture/RevitBatchProcessor)
  - revit-ifc plugin installed
"""

import clr
import os
import json

clr.AddReference('RevitAPI')
from Autodesk.Revit.DB import (
    IFCExportOptions,
    IFCVersion,
    Transaction,
)

# RevitBatchProcessor provides these utilities
import revit_script_util
from revit_script_util import Output

doc = revit_script_util.GetScriptDocument()

# --------------------------------------------------------------------------
# Read params.json
# --------------------------------------------------------------------------

input_path = doc.PathName
params = {}

params_path = os.path.join(os.path.dirname(input_path), 'params.json')
if os.path.exists(params_path):
    try:
        with open(params_path, 'r') as f:
            params = json.load(f)
    except Exception as e:
        Output("WARN: Could not read params.json: {}".format(e))

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
options.AddOption("ExportInternalRevitPropertySets", "true")
options.AddOption("ExportIFCCommonPropertySets", "true")
options.AddOption("SitePlacement", "0")

# --------------------------------------------------------------------------
# Output paths
# --------------------------------------------------------------------------

output_dir = params.get('outputDir', os.path.dirname(input_path))
output_name = params.get(
    'outputName',
    os.path.splitext(os.path.basename(input_path))[0] + '.ifc'
)

# --------------------------------------------------------------------------
# Run IFC export
# --------------------------------------------------------------------------

Output("EXPORT_START")
Output("INPUT_PATH:" + input_path)
Output("OUTPUT_DIR:" + output_dir)
Output("OUTPUT_NAME:" + output_name)
Output("IFC_VERSION:" + version_key)

try:
    with Transaction(doc, "Jens IFC Export") as t:
        t.Start()
        result = doc.Export(output_dir, output_name, options)
        t.RollBack()

    full_output = os.path.join(output_dir, output_name)

    if result:
        Output("EXPORT_RESULT:SUCCESS")
        Output("OUTPUT_PATH:" + full_output)
    else:
        Output("EXPORT_RESULT:FAILED")
        Output("ERROR:Revit Document.Export() returned False")

except Exception as ex:
    Output("EXPORT_RESULT:ERROR")
    Output("ERROR:" + str(ex))
