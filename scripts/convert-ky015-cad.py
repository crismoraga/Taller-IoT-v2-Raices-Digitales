#!/usr/bin/env python3
"""Convert an explicitly supplied KY-015 STEP to a private-metadata-free GLB.

Optional development dependencies: cadquery, OCP and numpy. They are not
runtime or build dependencies. Original STEP names, headers, paths and author
metadata are never copied to the output. The mesh preserves the actual CAD
faces and face colours; only the PCB's white printing is recoloured so the
application can draw the selected physical pin order itself.
"""
import argparse
import json
import struct
from collections import defaultdict
from pathlib import Path

import cadquery as cq
import numpy as np
from cadquery.occ_impl.importers.assembly import _get_shape_color
from OCP.IFSelect import IFSelect_RetDone
from OCP.STEPCAFControl import STEPCAFControl_Reader
from OCP.TCollection import TCollection_ExtendedString
from OCP.TDF import TDF_LabelSequence
from OCP.TDocStd import TDocStd_Document
from OCP.XCAFDoc import XCAFDoc_DocumentTool


def srgb_to_linear(value):
    return value / 12.92 if value <= 0.04045 else ((value + 0.055) / 1.055) ** 2.4


def convert(source: Path, destination: Path):
    reader = STEPCAFControl_Reader()
    reader.SetColorMode(True)
    reader.SetNameMode(False)
    if reader.ReadFile(str(source)) != IFSelect_RetDone:
        raise ValueError("Unable to read the supplied CAD")
    document = TDocStd_Document(TCollection_ExtendedString("XmXCAF"))
    if not reader.Transfer(document):
        raise ValueError("Unable to transfer CAD topology")
    shapes = XCAFDoc_DocumentTool.ShapeTool_s(document.Main())
    colors = XCAFDoc_DocumentTool.ColorTool_s(document.Main())
    labels = TDF_LabelSequence()
    shapes.GetFreeShapes(labels)
    if labels.Length() != 1:
        raise ValueError("Expected a single KY-015 compound")
    shape = cq.Shape.cast(shapes.GetShape_s(labels.Value(1)))
    solids = shape.Solids()
    if len(solids) != 8:
        raise ValueError("Expected the eight solids in the supplied KY-015 CAD")
    # Centre on the middle 2.54 mm header pin, and keep native pin tips at
    # the scene's inserted-leg height. CAD millimetres remain millimetres.
    center_x = 9.8532617359336
    header_y = 12.2301779833997
    tip_z = 27.605090429270465
    insertion_mm = 0.19 / (0.13 / 2.54)
    groups = defaultdict(lambda: {"positions": [], "normals": [], "indices": []})
    for solid_index, solid in enumerate(solids):
        for face in solid.Faces():
            color = _get_shape_color(face.wrapped, colors)
            rgba = color.toTuple() if color else (0.22, 0.25, 0.22, 1)
            # The original PCB has a fixed printed order. Paint its white
            # silkscreen the PCB colour; runtime labels follow part.holes.
            if solid_index == 7 and min(rgba[:3]) > 0.98:
                rgba = (0.102, 0.102, 0.102, 1)
            key = tuple(round(channel, 5) for channel in rgba)
            vertices, triangles = face.tessellate(0.12, 0.35)
            if not triangles:
                continue
            points = np.asarray([[v.x - center_x, tip_z - v.z - insertion_mm, v.y - header_y] for v in vertices], dtype=np.float32)
            indices = np.asarray(triangles, dtype=np.uint32)
            normals = np.zeros_like(points)
            for triangle in indices:
                normal = np.cross(points[triangle[1]] - points[triangle[0]], points[triangle[2]] - points[triangle[0]])
                length = np.linalg.norm(normal)
                if length > 1e-10:
                    normal /= length
                normals[triangle] += normal
            lengths = np.linalg.norm(normals, axis=1)
            lengths[lengths < 1e-10] = 1
            normals /= lengths[:, None]
            group = groups[key]
            offset = len(group["positions"])
            group["positions"].extend(points.tolist())
            group["normals"].extend(normals.tolist())
            group["indices"].extend((indices + offset).reshape(-1).tolist())
    gltf = {"asset": {"version": "2.0", "generator": "Raices Digitales local CAD converter"}, "scene": 0, "scenes": [{"nodes": [0]}], "nodes": [{"mesh": 0}], "meshes": [{"primitives": []}], "materials": [], "accessors": [], "bufferViews": [], "buffers": []}
    binary = bytearray()

    def add(array, target, component_type, kind):
        nonlocal binary
        padding = (-len(binary)) % 4
        binary.extend(b"\0" * padding)
        offset = len(binary)
        binary.extend(array.tobytes())
        view = len(gltf["bufferViews"])
        gltf["bufferViews"].append({"buffer": 0, "byteOffset": offset, "byteLength": array.nbytes, "target": target})
        accessor = {"bufferView": view, "componentType": component_type, "count": len(array), "type": kind}
        if kind == "VEC3":
            accessor["min"] = array.min(axis=0).tolist()
            accessor["max"] = array.max(axis=0).tolist()
        result = len(gltf["accessors"])
        gltf["accessors"].append(accessor)
        return result

    for material_index, (rgba, group) in enumerate(groups.items()):
        dark = max(rgba[:3]) < 0.25
        steel = max(rgba[:3]) - min(rgba[:3]) < 0.08 and 0.5 < sum(rgba[:3]) / 3 < 0.85
        gltf["materials"].append({"pbrMetallicRoughness": {"baseColorFactor": [*[srgb_to_linear(c) for c in rgba[:3]], rgba[3]], "metallicFactor": 0.65 if steel else 0, "roughnessFactor": 0.36 if steel else 0.65 if dark else 0.5}, "doubleSided": True})
        position = add(np.asarray(group["positions"], dtype="<f4"), 34962, 5126, "VEC3")
        normal = add(np.asarray(group["normals"], dtype="<f4"), 34962, 5126, "VEC3")
        index = add(np.asarray(group["indices"], dtype="<u4"), 34963, 5125, "SCALAR")
        gltf["meshes"][0]["primitives"].append({"attributes": {"POSITION": position, "NORMAL": normal}, "indices": index, "material": material_index})
    gltf["buffers"].append({"byteLength": len(binary)})
    json_bytes = json.dumps(gltf, separators=(",", ":")).encode()
    json_bytes += b" " * ((-len(json_bytes)) % 4)
    binary.extend(b"\0" * ((-len(binary)) % 4))
    result = struct.pack("<4sII", b"glTF", 2, 12 + 8 + len(json_bytes) + 8 + len(binary)) + struct.pack("<I4s", len(json_bytes), b"JSON") + json_bytes + struct.pack("<I4s", len(binary), b"BIN\0") + binary
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_bytes(result)
    print(json.dumps({"solidCount": len(solids), "materialCount": len(groups), "triangles": sum(len(g["indices"]) // 3 for g in groups.values()), "bytes": len(result)}))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path)
    parser.add_argument("destination", type=Path)
    arguments = parser.parse_args()
    convert(arguments.source, arguments.destination)
