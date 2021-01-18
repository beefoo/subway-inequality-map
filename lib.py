# -*- coding: utf-8 -*-

import csv
import glob
import json
import math
import numpy as np
import os
from scipy.ndimage.filters import gaussian_filter

def createLookup(arr, key):
    return dict([(str(item[key]), item) for item in arr])

def distance(p0, p1):
    return math.sqrt((p0[0] - p1[0])**2 + (p0[1] - p1[1])**2)

def distance3(p0, p1):
    x = p1[0] - p0[0]
    y = p1[1] - p0[1]
    z = p1[2] - p0[2]
    return math.sqrt(x**2 + y**2 + z**2)

def getBasename(fn):
    return os.path.splitext(os.path.basename(fn))[0]

def getFilenames(fileString, verbose=True):
    files = []
    if "*" in fileString:
        files = glob.glob(fileString)
    else:
        files = [fileString]
    fileCount = len(files)
    files = sorted(files)
    if verbose:
        print("Found %s files" % fileCount)
    return files

def getHeatmap(xyzs, intensity=204, s=18, bins=1000):
    a = np.array(xyzs)
    x, y, z = a.T
    z = z * intensity
    heatmap, xedges, yedges = np.histogram2d(x, y, bins=bins, weights=z)
    heatmap = gaussian_filter(heatmap, sigma=s)
    extent = tuple([int(xedges[0]), int(yedges[0]), int(xedges[-1]), int(yedges[-1])])
    pixels = heatmap.T
    pixels = 255 * pixels
    pixels = pixels.astype(np.uint8)
    return pixels, extent

def lim(value, ab=(0, 1)):
    a, b = ab
    return max(a, min(b, value))

def norm(value, ab, limit=False):
    a, b = ab
    n = 0.0
    if (b - a) != 0:
        n = 1.0 * (value - a) / (b - a)
    if limit:
        n = lim(n)
    return n

def parseHeadings(arr, headings):
    newArr = []
    headingKeys = [key for key in headings]
    for i, item in enumerate(arr):
        newItem = {}
        for key in item:
            if key in headingKeys:
                newItem[headings[key]] = item[key]
        newArr.append(newItem)
    return newArr

def parseNumber(string):
    try:
        num = float(string)
        if "." not in string:
            num = int(string)
        return num
    except ValueError:
        return string

def parseNumbers(arr):
    for i, item in enumerate(arr):
        for key in item:
            arr[i][key] = parseNumber(item[key])
    return arr

def radiansBetweenPoints(p1, p2):
    x1, y1 = p1
    x2, y2 = p2
    deltaX = x2 - x1;
    deltaY = y2 - y1;
    return math.atan2(deltaY, deltaX)

def readCsv(filename, doParseNumbers=True, skipLines=0, encoding="utf8", readDict=True, verbose=True):
    rows = []
    fieldnames = []
    if os.path.isfile(filename):
        lines = []
        with open(filename, 'r', encoding=encoding, errors="replace") as f:
            lines = list(f)
        if skipLines > 0:
            lines = lines[skipLines:]
        if readDict:
            reader = csv.DictReader(lines, skipinitialspace=True)
            fieldnames = list(reader.fieldnames)
        else:
            reader = csv.reader(lines, skipinitialspace=True)
        rows = list(reader)
        if doParseNumbers:
            rows = parseNumbers(rows)
        if verbose:
            print("  Read %s rows from %s" % (len(rows), filename))
    return (fieldnames, rows)

def readJSON(filename):
    data = {}
    if os.path.isfile(filename):
        with open(filename, encoding="utf8") as f:
            data = json.load(f)
    return data

def roundInt(n):
    return int(round(n))

def translatePoint(p, radians, distance):
    x, y = p
    x2 = x + distance * math.cos(radians)
    y2 = y + distance * math.sin(radians)
    return (x2, y2)

def writeJSON(filename, data, verbose=True, pretty=False):
    with open(filename, 'w') as f:
        if pretty:
            json.dump(data, f, indent=4)
        else:
            json.dump(data, f)
        if verbose:
            print("Wrote data to %s" % filename)
