This guide provides a practical structure, explains essential endpoints and features, and suggests ways to integrate the API for your own use cases.

Qloo Insights API Usage Guide
The Qloo Insights API provides taste-based insights and cultural intelligence, helping uncover the underlying factors that shape human preferences across entities like brands, artists, destinations, and more.

Overview
Base URL: https://staging.api.qloo.com/v2/insights

Purpose: Retrieve nuanced, affinity-driven insights about entities based on diverse input signals (demographics, interests, tags, location, etc.).

Key Use Cases: Audience analysis, recommendation systems, affinity mapping for brands, media, destinations, and more.

Getting Started
Authentication
You will need to provide an API key in the X-Api-Key header with every request.

text
GET /v2/insights?filter.type=urn%3Aentity%3Aartist
Host: staging.api.qloo.com
accept: application/json
X-Api-Key: [YOUR_API_KEY]
Core Endpoint: Insights API
Basic Request
Retrieves insights for a particular entity type (e.g., artist):

bash
curl --request GET \
 --url 'https://staging.api.qloo.com/v2/insights?filter.type=urn%3Aentity%3Aartist' \
 --header 'accept: application/json' \
 --header 'X-Api-Key: [YOUR_API_KEY]'
Key Query Parameters
The API supports a wide array of filter and signal parameters. Here’s how you can leverage them:

Required
filter.type:

Required entity type to return.

Examples: urn:entity:artist, urn:entity:brand, urn:entity:movie, urn:entity:place, etc.

Common Filters
filter.address: Filter results by address string (partial matching).

filter.geocode.name: Filter by city/town.

filter.geocode.country_code: Filter by country (two-letter code).

filter.tags: Filter entities by associated tag IDs.

Demographic and Affinity Signals
signal.demographics.age: Influence by age group (e.g., 36_to_55).

signal.demographics.gender: Influence by gender (male, female).

signal.location: Influence by geolocation (WKT POINT, place Qloo ID, etc.).

signal.interests.entities: List of entity IDs serving as positive affinity signals.

signal.interests.tags: List of tag IDs serving as positive affinity signals.

Advanced Features
feature.explainability:

If true, response provides metadata on which signals contributed to results.

diversify.by / diversify.take (city-based diversification):

Return max N top-affinity entities per city.

bias.trends:

Weigh trending entities more heavily in results (off, low, medium, high).

Example Use Cases

1. Recommend Trending Artists in a City
   bash
   curl --request GET \
    --url 'https://staging.api.qloo.com/v2/insights?filter.type=urn%3Aentity%3Aartist&filter.geocode.name=London&bias.trends=high'
   --header 'accept: application/json' \
    --header 'X-Api-Key: [YOUR_API_KEY]'
2. Filter by Demographics and Interests
   bash
   curl --request GET \
    --url 'https://staging.api.qloo.com/v2/insights?filter.type=urn%3Aentity%3Amovie&signal.demographics.gender=male&signal.demographics.age=36_to_55&signal.interests.tags=urn:tag:genre:media:horror'
   --header 'accept: application/json' \
    --header 'X-Api-Key: [YOUR_API_KEY]'
3. Get Place Recommendations by Affinity & Diversified by City
   bash
   curl --request GET \
    --url 'https://staging.api.qloo.com/v2/insights?filter.type=urn%3Aentity%3Aplace&diversify.by=properties.geocode.city&diversify.take=5'
   --header 'accept: application/json' \
    --header 'X-Api-Key: [YOUR_API_KEY]'
   Handling Responses
   A successful response (200 OK) will return a JSON array of entities with associated affinity scores and metadata.
   Set feature.explainability=true to receive a breakdown of which signals were most influential in generating each recommendation.

Tips & Best Practices
Sandbox vs. Production: Use the correct API base URL. Hackathon and production keys are not interchangeable.

Exploring Parameters: The docs UI allows you to test and see real responses interactively.

Rate Limiting: Check documentation or contact support about API rate limits for your plan.

Debugging: Leverage the explainability feature for transparency in result generation.

Helpful Links
Parameter Reference

Entity Type Parameter Guide

API Onboarding & Authentication

Feel free to tailor the above examples for your application. The Qloo Insights API is highly flexible and can be adapted for varied use cases in entertainment, travel, marketing, and beyond!
