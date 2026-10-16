"""CLI: python -m scripts.ingest_hepdata ins1234567 "Table 5" [--bin 3] [--version 1]

Prints a YAML `results:` snippet to stdout for an agent to paste in; never writes data files.
"""
import argparse
import sys
from pathlib import Path

from ruamel.yaml import YAML

from scripts.phenomap import hepdata

LABEL_MAP = Path(__file__).parent.parent / "data" / "hepdata_label_map.yaml"


def main(argv=None, fetch=hepdata.curl_get) -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("recid", help="ins<digits>")
    ap.add_argument("table")
    ap.add_argument("--bin", type=int, default=None, help="1-based bin for total_pct; default minimum over bins")
    ap.add_argument("--version", type=int, default=1)
    a = ap.parse_args(argv)
    if not a.recid.startswith("ins") or not a.recid[3:].isdigit():
        ap.error("recid must look like ins1234567")
    recid = int(a.recid[3:])
    table = hepdata.fetch_table(recid, a.table, a.version, fetch=fetch)
    label_map = YAML(typ="safe").load(LABEL_MAP)
    ref = f"hepdata:ins{recid}/{a.table}"
    unc = hepdata.summarize(table, label_map, ref)
    where = f"bin {a.bin}" if a.bin else "min over bins"
    result = {
        "measurement": "<MEAS-ID>",
        "total": {
            "value_pct": hepdata.round_sig(hepdata.total_pct(table, a.bin)),
            "provenance": {**unc[0]["provenance"], "locator": f"{a.table}, quadrature sum of all errors ({where})"},
        },
        "uncertainties": unc,
    }
    y = YAML()
    y.default_flow_style = False
    y.dump({"results": [result]}, sys.stdout)
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
