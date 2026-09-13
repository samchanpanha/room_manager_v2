#!/usr/bin/env python3
"""Generate default per-service Grafana dashboards for RentManager.

Run:  python3 deploy/grafana/generate-dashboards.py
Emits deploy/grafana/dashboards/rentmanager-<svc>-overview.json for every
service in SERVICES (scraped by deploy/prometheus/prometheus.yml).
"""
import json
import os

SERVICES = [
    ("gateway", "gateway:8080"),
    ("identity", "identity-service:8081"),
    ("property", "property-service:8082"),
    ("billing", "billing-service:8083"),
    ("ops", "ops-service:8084"),
    ("staff", "staff-service:8085"),
    ("commerce", "commerce-service:8086"),
    ("notification", "notification-service:8087"),
    ("report", "report-service:8088"),
]

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "dashboards")


def timeseries(pid, title, y, expr, legend, unit, color="palette-classic"):
    return {
        "datasource": {"type": "prometheus"},
        "fieldConfig": {
            "defaults": {
                "color": {"mode": color},
                "custom": {
                    "axisCenteredZero": False,
                    "axisColorMode": "text",
                    "axisLabel": "",
                    "axisPlacement": "auto",
                    "barAlignment": 0,
                    "drawStyle": "line",
                    "fillOpacity": 8,
                    "gradientMode": "none",
                    "hideFrom": {"legend": False, "tooltip": False, "viz": False},
                    "lineInterpolation": "linear",
                    "lineWidth": 1,
                    "pointSize": 5,
                    "scaleDistribution": {"type": "linear"},
                    "showPoints": "never",
                    "spanNulls": False,
                    "stacking": {"group": "A", "mode": "none"},
                    "thresholdsStyle": {"mode": "off"},
                },
                "mappings": [],
                "thresholds": {"mode": "absolute", "steps": [{"color": "green", "value": None}]},
                "unit": unit,
            },
            "overrides": [],
        },
        "gridPos": {"h": 8, "w": 12, "x": (0 if pid % 2 == 0 else 12), "y": y},
        "id": pid,
        "options": {
            "legend": {"calcs": [], "displayMode": "list", "placement": "bottom", "showLegend": True},
            "tooltip": {"mode": "multi", "sort": "desc"},
        },
        "targets": [
            {
                "datasource": {"type": "prometheus"},
                "expr": expr,
                "legendFormat": legend,
                "refId": "A",
            }
        ],
        "title": title,
        "type": "timeseries",
    }


def stat(pid, title, y, expr, legend, unit="short", green_threshold=1.0):
    return {
        "datasource": {"type": "prometheus"},
        "fieldConfig": {
            "defaults": {
                "color": {"mode": "thresholds"},
                "mappings": [],
                "thresholds": {
                    "mode": "absolute",
                    "steps": [
                        {"color": "red", "value": None},
                        {"color": "red", "value": green_threshold - 1},
                        {"color": "green", "value": green_threshold},
                    ],
                },
                "unit": unit,
            },
            "overrides": [],
        },
        "gridPos": {"h": 8, "w": 12, "x": (0 if pid % 2 == 0 else 12), "y": y},
        "id": pid,
        "options": {
            "colorMode": "background",
            "graphMode": "area",
            "justifyMode": "auto",
            "orientation": "horizontal",
            "reduceOptions": {"calcs": ["lastNotNull"], "fields": "", "values": False},
            "textMode": "auto",
        },
        "targets": [
            {
                "datasource": {"type": "prometheus"},
                "expr": expr,
                "legendFormat": legend,
                "refId": "A",
            }
        ],
        "title": title,
        "type": "stat",
    }


def build(svc, host):
    inst = json.dumps(host)
    panels = [
        stat(
            1,
            "Service up",
            0,
            f'up{{job="rentmanager-services",instance={inst}}}',
            "{{instance}}",
        ),
        timeseries(
            2,
            "HTTP requests /s (5m, by status)",
            0,
            f'sum by (status) (rate(http_server_requests_seconds_count{{job="rentmanager-services",instance={inst}}}[5m]))',
            "{{status}}",
            "reqps",
        ),
        timeseries(
            3,
            "HTTP avg latency (ms)",
            6,
            'sum by (instance) (rate(http_server_requests_seconds_sum{job="rentmanager-services",instance={inst}}[5m])) / '
            'sum by (instance) (rate(http_server_requests_seconds_count{job="rentmanager-services",instance={inst}}[5m])) * 1000',
            "{{instance}}",
            "ms",
            "fixed",
        ),
        timeseries(
            4,
            "JVM heap used (MB)",
            6,
            f'sum(jvm_memory_used_bytes{{job="rentmanager-services",instance={inst},area="heap"}}) / 1048576',
            "used",
            "decmbytes",
        ),
        timeseries(
            5,
            "GC pause (ms/s)",
            12,
            f'rate(jvm_gc_pause_seconds_sum{{job="rentmanager-services",instance={inst}}}[5m]) * 1000',
            "pause",
            "ms",
        ),
        timeseries(
            6,
            "CPU usage",
            12,
            f'process_cpu_usage{{job="rentmanager-services",instance={inst}}}',
            "process",
            "percentunit",
        ),
        stat(
            7,
            "Log errors (error+warn)",
            18,
            f'sum(rate(logback_events_total{{job="rentmanager-services",instance={inst},level=~"error|warn"}}[5m]))',
            "rate/s",
            "short",
            green_threshold=0,
        ),
        stat(
            8,
            "Hikari pool: active / max",
            18,
            f'max(hikaricp_connections_active{{job="rentmanager-services",instance={inst}}})',
            "active",
            "short",
            green_threshold=0,
        ),
    ]
    return {
        "annotations": {"list": []},
        "editable": True,
        "fiscalYearStartMonth": 0,
        "graphTooltip": 0,
        "id": None,
        "links": [],
        "panels": panels,
        "refresh": "30s",
        "schemaVersion": 39,
        "tags": ["rentmanager", svc],
        "templating": {"list": []},
        "time": {"from": "now-6h", "to": "now"},
        "timezone": "browser",
        "title": f"RentManager — {host}",
        "uid": f"rm-{svc}-overview",
        "version": 1,
    }


def build_all():
    """One dashboard integrating every Spring Boot service (variable: $instance)."""
    panels = [
        stat(
            1,
            "Service up",
            0,
            'up{job="rentmanager-services",instance=~"$instance"}',
            "{{instance}}",
        ),
        timeseries(
            2,
            "HTTP requests /s (5m, by instance + status)",
            0,
            'sum by (instance, status) (rate(http_server_requests_seconds_count{job="rentmanager-services",instance=~"$instance"}[5m]))',
            "{{instance}} {{status}}",
            "reqps",
        ),
        timeseries(
            3,
            "HTTP avg latency (ms)",
            6,
            'sum by (instance) (rate(http_server_requests_seconds_sum{job="rentmanager-services",instance=~"$instance"}[5m])) / '
            'sum by (instance) (rate(http_server_requests_seconds_count{job="rentmanager-services",instance=~"$instance"}[5m])) * 1000',
            "{{instance}}",
            "ms",
        ),
        timeseries(
            4,
            "JVM heap used (MB)",
            6,
            'sum by (instance) (jvm_memory_used_bytes{job="rentmanager-services",instance=~"$instance",area="heap"}) / 1048576',
            "{{instance}}",
            "decmbytes",
        ),
        timeseries(
            5,
            "GC pause (ms/s)",
            12,
            'rate(jvm_gc_pause_seconds_sum{job="rentmanager-services",instance=~"$instance"}[5m]) * 1000',
            "{{instance}}",
            "ms",
        ),
        timeseries(
            6,
            "CPU usage",
            12,
            'process_cpu_usage{job="rentmanager-services",instance=~"$instance"}',
            "{{instance}}",
            "percentunit",
        ),
        stat(
            7,
            "Log error+warn rate (1/s)",
            18,
            'sum by (level) (rate(logback_events_total{job="rentmanager-services",instance=~"$instance",level=~"error|warn"}[5m]))',
            "{{level}}",
            "short",
            green_threshold=0,
        ),
        stat(
            8,
            "Hikari active connections",
            18,
            'sum by (instance) (hikaricp_connections_active{job="rentmanager-services",instance=~"$instance"})',
            "{{instance}}",
            "short",
            green_threshold=0,
        ),
    ]
    return {
        "annotations": {"list": []},
        "editable": True,
        "fiscalYearStartMonth": 0,
        "graphTooltip": 1,
        "id": None,
        "links": [],
        "panels": panels,
        "refresh": "30s",
        "schemaVersion": 39,
        "tags": ["rentmanager", "spring-boot"],
        "templating": {
            "list": [
                {
                    "allValue": ".*",
                    "current": {"selected": True, "text": "All", "value": "$__all"},
                    "datasource": {"type": "prometheus"},
                    "definition": "label_values(up{job=\"rentmanager-services\"}, instance)",
                    "hide": 0,
                    "includeAll": True,
                    "multi": False,
                    "name": "instance",
                    "options": [],
                    "query": {"query": "label_values(up{job=\"rentmanager-services\"}, instance)", "refId": "A"},
                    "refresh": 1,
                    "regex": "",
                    "skipUrlSync": False,
                    "sort": 1,
                    "type": "query",
                }
            ]
        },
        "time": {"from": "now-6h", "to": "now"},
        "timezone": "browser",
        "title": "RentManager Spring Boot — All Services",
        "uid": "rm-springboot-all",
        "version": 1,
    }


def main():
    os.makedirs(OUT, exist_ok=True)
    for svc, host in SERVICES:
        fname = os.path.join(OUT, f"rentmanager-{svc}-overview.json")
        with open(fname, "w") as f:
            json.dump(build(svc, host), f, indent=2)
        print(f"wrote {fname}")
    fname = os.path.join(OUT, "rentmanager-springboot-all.json")
    with open(fname, "w") as f:
        json.dump(build_all(), f, indent=2)
    print(f"wrote {fname}")


if __name__ == "__main__":
    main()