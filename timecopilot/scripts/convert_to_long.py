import argparse
from pathlib import Path

import pandas as pd


def _fill_missing_slots(df: pd.DataFrame, freq: str) -> pd.DataFrame:
    df = df.set_index("ds").sort_index()
    df = df.asfreq(freq)
    df["y"] = df["y"].interpolate(limit_direction="both")
    df = df.reset_index()
    return df


def convert_to_long(
    source: Path,
    destination: Path,
    *,
    time_columns: list[str] | None = None,
    dayfirst: bool = True,
    series_name: str = "series_0",
    freq: str = "15min",
    fill_method: str = "interpolate",
) -> None:
    df = pd.read_csv(source)
    df = df.replace("No Data", pd.NA)

    if time_columns is None:
        time_columns = [
            col
            for col in df.columns
            if col not in {"Date", "Half Day", "Full Day"}
        ]

    melted = (
        df.melt(
            id_vars="Date",
            value_vars=time_columns,
            var_name="slot",
            value_name="y",
        )
        .copy()
    )

    melted["ds"] = pd.to_datetime(
        melted["Date"] + " " + melted["slot"],
        dayfirst=dayfirst,
        errors="coerce",
    )
    melted = melted.dropna(subset=["ds"])

    if fill_method == "zero":
        melted["y"] = pd.to_numeric(melted["y"], errors="coerce").fillna(0.0)
    else:
        melted["y"] = pd.to_numeric(melted["y"], errors="coerce")

    melted["unique_id"] = series_name

    tidy = melted[["unique_id", "ds", "y"]]

    if fill_method == "interpolate":
        tidy = _fill_missing_slots(tidy, freq)
        tidy["unique_id"] = series_name
    elif fill_method == "ffill":
        tidy = tidy.set_index("ds").sort_index()
        tidy["y"] = tidy["y"].ffill().bfill()
        tidy = tidy.reset_index()

    tidy = tidy.sort_values("ds")
    destination.parent.mkdir(parents=True, exist_ok=True)
    tidy.to_csv(destination, index=False)


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Convert wide intraday CSV into TimeCopilot long format."
    )
    parser.add_argument("source", type=Path, help="Path to input CSV.")
    parser.add_argument(
        "--dest",
        type=Path,
        default=Path("series_long.csv"),
        help="Output CSV path (default: series_long.csv).",
    )
    parser.add_argument(
        "--series-name",
        default="series_0",
        help="Value to use for the unique_id column.",
    )
    parser.add_argument(
        "--freq",
        default="15min",
        help="Frequency to enforce when filling missing slots (default: 15min).",
    )
    parser.add_argument(
        "--fill-method",
        choices=["interpolate", "zero", "ffill", "drop"],
        default="interpolate",
        help="How to handle missing slots: interpolate (default), zero, ffill, or drop.",
    )
    parser.add_argument(
        "--keep-half-full",
        action="store_true",
        help="Include Half Day / Full Day columns as separate series.",
    )
    args = parser.parse_args()

    output = args.dest

    time_columns = [
        "9:15",
        "9:45",
        "10:15",
        "10:45",
        "11:15",
        "11:45",
        "12:15",
        "12:45",
        "13:15",
        "13:45",
        "14:15",
        "14:45",
        "15:15",
    ]

    convert_to_long(
        args.source,
        output,
        time_columns=time_columns,
        series_name=args.series_name,
        freq=args.freq,
        fill_method=args.fill_method,
    )

    if args.keep_half_full:
        df = pd.read_csv(args.source).replace("No Data", pd.NA)
        half_full = df[["Date", "Half Day", "Full Day"]].copy()
        half_full = half_full.melt(
            id_vars="Date",
            var_name="slot",
            value_name="y",
        ).dropna(subset=["y"])
        half_full["ds"] = pd.to_datetime(
            half_full["Date"] + " " + half_full["slot"],
            dayfirst=True,
            errors="coerce",
        )
        half_full = half_full.dropna(subset=["ds"])
        half_full["unique_id"] = half_full["slot"].map(
            {"Half Day": f"{args.series_name}_half", "Full Day": f"{args.series_name}_full"}
        )

        tidy_half_full = half_full[["unique_id", "ds", "y"]]
        tidy = pd.read_csv(output, parse_dates=["ds"])
        combined = pd.concat([tidy, tidy_half_full], ignore_index=True)
        combined.sort_values("ds").to_csv(output, index=False)


if __name__ == "__main__":
    main()

