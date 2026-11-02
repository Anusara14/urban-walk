# KML validation report

Source: `data/source/urban-walk.kml` · generated 2026-11-02T13:55:45.392Z

- Features extracted: **35**
  - locations / Point: 17
  - locations / Polygon: 2
  - Finalized Layer / Point: 13
  - Urban Walk Final Route / LineString: 1
  - Urban Walk Final Route / Point: 2
- Route coordinates: **237** (length 3.52 km)
- Start marker: Old Town Hall Building and Museum — 0 m from first route vertex
- End marker: 80 Galle Rd, Colombo 00300, Sri Lanka — 1 m from last route vertex
- Segments: none — single LineString; '06 Segments' appears only in the document description
- Bounding box (minLon, minLat, maxLon, maxLat): 79.837181, 6.917898, 79.854091, 6.938984
- Invalid / missing geometries: none

## Near-duplicate points (≤ 60 m)

| A | B | Distance (m) |
|---|---|---|
| Warm Up @ Galle Face Green [locations] | Gall Face Green [Finalized Layer] | 40.9 |
| Warm Up @ Galle Face Green [locations] | Public Washrooms [Finalized Layer] | 47.3 |
| Old Parliament [locations] | Old Parlimant [Finalized Layer] | 53.3 |
| Colombo Old Clock Tower [locations] | Historic Central Point Building [locations] | 26.7 |
| Colombo Old Clock Tower [locations] | Historic Central Point Building [Finalized Layer] | 22.3 |
| Colombo Old Clock Tower [locations] | Colombo Old Clock Tower [Finalized Layer] | 7.3 |
| Cargills Building [locations] | Cargills Building [Finalized Layer] | 0 |
| Historic Central Point Building [locations] | Historic Central Point Building [Finalized Layer] | 8.8 |
| Historic Central Point Building [locations] | Colombo Old Clock Tower [Finalized Layer] | 22.4 |
| Gaffoor Building [locations] | Gaffor Building [Finalized Layer] | 11.1 |
| De Mel building [locations] | De Mel Building [Finalized Layer] | 5.6 |
| Jami Ul-Alfar Mosque [locations] | Jami Ul Alfar Mosque [Finalized Layer] | 33.6 |
| Sri Lanka Tourism Development Authority [locations] | SLTDA [Finalized Layer] | 22.3 |
| Sri Lanka Tourism Development Authority [locations] | 80 Galle Rd, Colombo 00300, Sri Lanka [Urban Walk Final Route] | 26.9 |
| Gall Face Green [Finalized Layer] | Public Washrooms [Finalized Layer] | 53.1 |
| Historic Central Point Building [Finalized Layer] | Colombo Old Clock Tower [Finalized Layer] | 20.4 |
| SLTDA [Finalized Layer] | 80 Galle Rd, Colombo 00300, Sri Lanka [Urban Walk Final Route] | 12.9 |
| Old Town Hall Building and Museum [Finalized Layer] | Old Town Hall Building and Museum [Urban Walk Final Route] | 13.2 |

## Finalized Layer vs locations

| Finalized | Closest in locations | Distance (m) | Same name |
|---|---|---|---|
| Old Parlimant | Old Parliament | 53.3 | no (spelling differs) |
| Gall Face Green | Warm Up @ Galle Face Green | 40.9 | no (spelling differs) |
| Historic Central Point Building | Historic Central Point Building | 8.8 | yes |
| Jami Ul Alfar Mosque | Jami Ul-Alfar Mosque | 33.6 | yes |
| SLTDA | Sri Lanka Tourism Development Authority | 22.3 | no (spelling differs) |
| De Mel Building | De Mel building | 5.6 | yes |
| Colombo Old Clock Tower | Colombo Old Clock Tower | 7.3 | yes |
| Gaffor Building | Gaffoor Building | 11.1 | no (spelling differs) |
| Cargills Building | Cargills Building | 0 | yes |
| Old Town Hall Building and Museum | Jami Ul-Alfar Mosque | 283.5 | no (spelling differs) |

Only in `locations` (no Finalized point within 60 m): The Old Hospital, Colombo Railway Station, Grand Oriental Hotel, OLD GENERAL POST OFFICE (GPO), Delft Gateway - Colombo Fort, Colombo Port City Foot Bridge, One Galle Face Mall, Dutch Museum
