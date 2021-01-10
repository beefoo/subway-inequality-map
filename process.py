# -*- coding: utf-8 -*-

import argparse
import json
from lib import *
import math
import os
from PIL import Image
from pprint import pprint
import sys

# input
parser = argparse.ArgumentParser()
parser.add_argument('-data', dest="ROUTE_DATA", default="data/routes.json", help="Route data file")
parser.add_argument('-udata', dest="UROUTE_DATA", default="data/uroutes.json", help="User generated route data file")
parser.add_argument('-lines', dest="LINE_DATA", default="data/lines/*.csv", help="Line data files")
parser.add_argument('-width', dest="WIDTH", default=2700, type=int, help="Width of document")
parser.add_argument('-height', dest="HEIGHT", default=3314, type=int, help="Height of document")
parser.add_argument('-heat', dest="OUTPUT_HEAT_FILE", default="img/heatmap.png", help="output heatmap file")
parser.add_argument('-out', dest="OUTPUT_FILE", default="data/appRoutes.json", help="output file")
a = parser.parse_args()

routes = readJSON(a.ROUTE_DATA)
uroutes = readJSON(a.UROUTE_DATA)

# add uroutes to routes
for i, route in enumerate(routes):
    id = route["id"]
    if id not in uroutes:
        continue
    uroute = uroutes[id]
    for j, station in enumerate(route["stations"]):
        sid = station["id"]
        if sid not in uroute["stations"]:
            continue
        ustation = uroute["stations"][sid]
        routes[i]["stations"][j].update(ustation)

    stations = routes[i]["stations"]
    groups = [[s.copy() for s in stations]]
    # check if we have groups that we need to break up
    if "groups" in route and len(route["groups"]) > 0:
        groups = []
        for group in route["groups"]:
            gstations = [s.copy() for s in stations if "groups" in s and group in s["groups"]]
            groups.append(gstations)
    # take the first group
    routes[i]["groups"] = groups
    routes[i]["stations"] = groups[0]
routeLookup = createLookup(routes, "id")

lineFiles = getFilenames(a.LINE_DATA)
lines = {}
maxIncome = None
minIncome = None
for fn in lineFiles:
    _, fLines = readCsv(fn)
    basename = getBasename(fn)
    lineName = basename
    lineRouteName = None
    if "_" in basename:
        lineName, lineRouteName = tuple(basename.split("_"))
    if lineName not in lines:
        if lineName not in routeLookup:
            print(f'No match for {lineName} in routes')
            continue
        routeStations = routeLookup[lineName]["stations"]
        if len(routeStations) != len(fLines):
            print(f'Count mismatch for {lineName}: {len(routeStations)} != {len(fLines)}')
            continue
        # check if we should reverse
        rFirst = str(routeStations[0]["id"])
        rLast = str(routeStations[-1]["id"])
        lFirst = str(fLines[0]["Station ID"])
        if rFirst != lFirst and rLast == lFirst:
            routeStations = list(reversed(routeStations))
        elif rFirst != lFirst and rLast != lFirst:
            print(f'ID mismatch for {lineName}: {rFirst} != {lFirst} and {rLast} != {lFirst}')
            continue
        # add point to lines
        for i, fLine in enumerate(fLines):
            fLines[i]["point"] = routeStations[i]["point"]
        # get income
        incomes = [fLine["income"] for fLine in fLines]
        maxIncome = max(incomes) if maxIncome is None else max(max(incomes), maxIncome)
        minIncome = min(incomes) if minIncome is None else min(min(incomes), minIncome)
        lines[lineName] = {
            "id": lineName,
            "stations": fLines,
            "color": fLines[0]["color"]
        }

stationCount = 0
for k, d in lines.items():
    totalDistance = 0
    for i, s in enumerate(d["stations"]):
        if i > 0:
            prevPoint = d["stations"][i-1]["point"]
            sDistance = distance(prevPoint, s["point"])
            totalDistance += sDistance
        lines[k]["stations"][i]["distance"] = totalDistance
    stations = []
    for i, s in enumerate(d["stations"]):
        stations.append({
            "name": s["Stop Name"],
            "borough": s["Borough"],
            "tract": s["tractId1"],
            "income": s["income"],
            "ndistance": 1.0 * s["distance"] / totalDistance,
            "nincome": norm(s["income"], (minIncome, maxIncome)),
            "point": s["point"]
        })
    lines[k]["stations"] = stations
    stationCount += len(stations)

xyzs = []
for k, d in lines.items():
    for i, s in enumerate(d["stations"]):
        xyzs.append((s["point"][0], s["point"][1], s["nincome"]))
pixels, extent = getHeatmap(xyzs)
x0, y0, x1, y1 = extent
dw = x1 - x0
dh = y1 - y0
imData = Image.fromarray(pixels)
imData = imData.resize((dw, dh))

im = Image.new("L", (a.WIDTH, a.HEIGHT), 0)
im.paste(imData, box=extent)
im.save(a.OUTPUT_HEAT_FILE)

jsonOut = {}
jsonOut["lines"] = lines
jsonOut["width"] = a.WIDTH
jsonOut["height"] = a.HEIGHT
jsonOut["stationCount"] = stationCount
writeJSON(a.OUTPUT_FILE, jsonOut)
