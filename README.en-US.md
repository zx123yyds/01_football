# 2026 World Cup Schedule

A website providing schedule information for the 2026 World Cup, based on Beijing Time, supporting search by date, stage, group, and team/city/venue, and generating ICS files that can be subscribed to calendars.

## Project Preview

![2026 World Cup Schedule Website Preview](docs/assets/world-cup-schedule-preview.png)

## Local Development

```bash
npm install
npm run build
npm run dev
```

## Validation

```bash
npm run check
```

## Data Explanation

The data source prioritizes verification against FIFA's official published schedule, and references Dongqiudi's Chinese schedule and reference sites' information architecture. The current source table includes 104 matches with Beijing Time, stage, group, and matchups; individual venue fields that have not been fully verified are displayed as "Pending Verification" without fabricating scores, progression results, or unconfirmed venues.
