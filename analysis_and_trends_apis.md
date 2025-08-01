Below is a structured Markdown guide for all Qloo Analysis & Trends APIs, which you can append to your documentation file. It highlights each endpoint, its main purpose, query parameters, and example usage.

Qloo Analysis & Trends APIs Guide

1. Analysis
   Endpoint:
   GET https://api.qloo.com/analysis

Description:
Analyze a group of entities to uncover trends or summarized properties for a set.

Query Parameters:

entity_ids (array of uuids, required): Qloo entity IDs to analyze.

filter.type (array of strings): Categories to filter by.

model (string): Select the underlying model ("descriptive", "predictive").

filter.subtype (string): Subtypes to filter results (e.g., specific tags).

page (int, default: 1): Results page.

take (int, default: 20): Number of records returned.

Example Request:

bash
curl --request GET \
 --url 'https://api.qloo.com/analysis?entity_ids=id1,id2&page=1&take=20'
--header 'accept: application/json' 2. Analysis Compare
Endpoint:
GET https://api.qloo.com/v2/insights/compare

Description:
Analyze and compare two groups of entities.

Query Parameters:

a.signal.interests.entities (array of strings, required): First set of entities.

b.signal.interests.entities (array of strings, required): Second set of entities.

filter.type (array of strings): Entity categories.

filter.subtype (string): Filter by subtype/tag.

model (string): Select model ("descriptive", "predictive").

page (int, default: 1)

take (int, default: 20)

offset (int): How many results to skip.

Example Request:

bash
curl --request GET \
 --url 'https://api.qloo.com/v2/insights/compare?page=1&take=20'
--header 'accept: application/json' 3. Get Trending Data
Endpoint:
GET https://staging.api.qloo.com/v2/trending

Description:
Returns time-series data showing popularity trends for a specific entity (weekly series, percentile, velocity, etc.), allowing you to monitor changes over any time period.

Required Query Parameters:

signal.interests.entities (array of strings): Qloo entity IDs to track.

filter.type (string): Entity category (e.g., urn:entity:artist).

filter.start_date (date, ISO 8601): Start date (YYYY-MM-DD).

filter.end_date (date, ISO 8601): End date (YYYY-MM-DD).

Optional Query Parameters:

page (int)

take (int)

offset (int)

Example Request:

bash
curl --request GET \
 --url 'https://staging.api.qloo.com/v2/trending?filter.type=urn:entity:artist&signal.interests.entities=id1&filter.start_date=2025-01-01&filter.end_date=2025-08-01'
--header 'accept: application/json'
