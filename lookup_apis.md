Here is a structured Markdown documentation for all Qloo Lookup APIs, followed by a Python script to export this content to a .md file.

Qloo Lookup APIs Guide

1. Entity Search
   Endpoint:
   GET https://api.qloo.com/search

Description:
Search for an entity by name or property.

Query Parameters:

query (string): Text to search against.

types (array of strings): Entity categories.

filter.location (string): Base searches on a geolocational point (format: "latitude,longitude").

filter.radius (float, 0–100, default: 10): Max distance (miles) from location for relevant categories.

filter.exists (array of strings): Requires existential property (e.g., external.resy).

filter.tags (array of strings): Match entities with specific tags.

filter.rating (double, 0–5): Minimum business rating.

filter.exclude.tags (array): Exclude entities having these tags.

filter.popularity (double, 0–1): Minimum popularity percentile.

operator.filter.tags (string, "union"|"intersection", default: union): AND/OR logic for tags.

operator.filter.exclude.tags (string): AND/OR logic for tag exclusions.

page (int, default: 1): Page number.

take (int, default: 20): Number of records.

sort_by (string, default: match): Sort (match|distance|popularity).

Example Request:

bash
curl --request GET \
 --url 'https://api.qloo.com/search?query=Madonna&types=artist'
--header 'accept: application/json' 2. Entity Search by ID
Endpoint:
GET https://api.qloo.com/entities

Description:
Get entities based on an array of IDs or external IDs.

Query Parameters:

entity_ids (array of UUIDs): Qloo entity IDs.

External ID arrays (e.g., external.imdb.ids, external.spotify.ids, external.isbn13.ids, etc.): Various supported tools/platforms.

Example Request:

bash
curl --request GET \
 --url 'https://api.qloo.com/entities?entity_ids=[id1],[id2]'
--header 'accept: application/json' 3. Find Audiences
Endpoint:
GET https://staging.api.qloo.com/v2/audiences

Description:
Retrieve a list of audience IDs for filtering and refining targeting in recommendations.
Audience IDs can be used with signal.demographics.audiences in Insights queries.

Query Parameters:

filter.parents.types (string): Comma-separated parent entity types.

filter.results.audiences (array): Specific audience IDs.

filter.audience.types (array): List of audience types.

filter.popularity.min / filter.popularity.max (number, 0–1): Popularity percentile bounds.

page (int): Page.

take (int): Results per page.

Example Request:

bash
curl --request GET \
 --url 'https://staging.api.qloo.com/v2/audiences'
--header 'accept: application/json' 4. Get Audience Types
Endpoint:
GET https://staging.api.qloo.com/v2/audiences/types

Description:
Returns all audience type IDs (categories/groups) for further filtering or exploration.

Query Parameters:

filter.parents.types (string): Comma-separated parents.

page (int)

take (int)

Example Request:

bash
curl --request GET \
 --url 'https://staging.api.qloo.com/v2/audiences/types'
--header 'accept: application/json' 5. Tags Search
Endpoint:
GET https://staging.api.qloo.com/v2/tags

Description:
Search for tags supported by filter.tags, exclude.tags, and signal.interests.tags.

Query Parameters:

feature.typo_tolerance (boolean, default: false): Typo-tolerant search.

filter.results.tags (array): Assess affinity.

filter.parents.types (string): Comma-separated parents.

filter.popularity.min / .max (number, 0–1): Percentiles.

filter.query (string): Query string (partial search).

filter.tag.types (array): Comma-separated tag types.

page (int)

take (int)

Example Request:

bash
curl --request GET \
 --url 'https://staging.api.qloo.com/v2/tags?feature.typo_tolerance=false'
--header 'accept: application/json' 6. Tag Types
Endpoint:
GET https://staging.api.qloo.com/v2/tags/types

Description:
Returns a list of tag types supported by each entity type.

Query Parameters:

filter.parents.types (string)

page (int)

take (int)

Example Request:

bash
curl --request GET \
 --url 'https://staging.api.qloo.com/v2/tags/types'
--header 'accept: application/json'
