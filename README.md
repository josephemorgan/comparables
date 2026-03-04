# comparables

CLI tool for finding comparable vehicle listings to support insurance total-loss negotiations.

Insurance companies use opaque systems (e.g., CCC ONE) to value totaled vehicles. This tool queries real active listings from the [MarketCheck](https://marketcheck.com) API, scores them by similarity to your vehicle, and outputs a ranked table with mileage-adjusted prices you can use as evidence.

## Install

```bash
npm install
npm link       # installs `comparables` as a global command
```

Requires **Node 22**.

## Setup

Copy `.env.example` to `.env` and add your [MarketCheck API key](https://marketcheck.com):

```bash
cp .env.example .env
# Edit .env and set MARKETCHECK_API_KEY=your_key_here
```

## Usage

```
comparables --mileage <n> --zip <zip> [options]
```

Identify your vehicle by VIN (auto-decoded) or manually:

```bash
# By VIN
comparables --vin 1HGBH41JXMN109186 --mileage 68000 --zip 90210

# Manually
comparables --year 2019 --make Honda --model Civic --trim EX \
            --mileage 68000 --zip 90210
```

### Options

| Flag | Default | Description |
|---|---|---|
| `--vin <vin>` | — | VIN to auto-decode year/make/model/trim |
| `--year <n>` | — | Model year (required if no VIN) |
| `--make <str>` | — | Make (required if no VIN) |
| `--model <str>` | — | Model (required if no VIN) |
| `--trim <str>` | — | Trim level |
| `--mileage <n>` | **required** | Your odometer reading |
| `--zip <zip>` | **required** | Your ZIP code |
| `--radius <miles>` | `100` | Search radius in miles |
| `--year-range <n>` | `1` | ±N years around model year |
| `--mileage-range <n>` | `25000` | ±N miles around your mileage |
| `--top <n>` | `10` | How many top results to include in summary |
| `--out <file>` | `comparables.csv` | CSV output path |
| `--rate <$/mile>` | `0.10` | Mileage adjustment rate per mile |
| `--api-key <key>` | — | MarketCheck API key (overrides `.env`) |

## Output

**Terminal table** — all ranked results with listed price, mileage-adjusted price, score, location, and link.

**Summary line** — average, min, and max adjusted price for the top N results.

**Methodology block** — exact search parameters and scoring explanation so you can document how the comparables were found.

**CSV file** — same data exported to spreadsheet format, with the methodology prepended for documentation purposes.

## Scoring

Each listing is scored out of 100 points:

| Component | Points | Method |
|---|---|---|
| Distance | 0–40 | Linear: 40 pts at 0 mi, 0 pts at radius limit |
| Mileage delta | 0–40 | Linear: 40 pts at exact match, 0 pts at ±mileage-range |
| Trim match | 0–20 | 20 pts exact, 10 pts partial, 0 pts no match |

Listings are ranked by score (highest first).

## Mileage Adjustment

```
Adjusted price = Listed price − (comp miles − subject miles) × rate/mile
```

If a comparable has more miles than your vehicle, its effective price is adjusted down. This normalizes prices to your mileage for apples-to-apples comparison. The default rate is $0.10/mile; adjust with `--rate`.

## Running Tests

```bash
npx vitest run
```
