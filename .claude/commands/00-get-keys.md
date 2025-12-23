---
model: haiku
description: Get API Keys from alpahavantage.com
argument-hint: [number of keys]
---

## Variables

NUMBER_OF_KEYS: $ARGUMENTS

## Instructions

Navigate to this website: https://www.alphavantage.co/support/#api-key, and do the following for {NUMBER_OF_KEYS} times:
  1. Refresh the page
  2. Fill `organization` with a random string; Fill `email` with a random email: <random>@gmail.com
  3. Click Get Fee API Key
  4. There should be an element $('p#talk') which says "Welcome to Alpha Vantage! Your API key is: xxxxx. Please record this API key
  at a safe place for future data access.", Note down the API Key xxxxx and append it to file `.keylist` (do not overwrite the
  file)
