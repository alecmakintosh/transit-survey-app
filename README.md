# Transit Survey Mapping

**Transit Survey Mapping** is an example implementation of a web-based approach to collecting travel behaviour data through an interactive trip-planning interface.

Rather than presenting respondents with conventional text-based travel scenarios, the application allows users to locate their own trip on a map, view routes generated from real transportation networks, compare existing and future travel options, and provide information about their travel choices and preferences.

This repository contains the implementation developed for a Toronto case study examining responses to major transit network changes. It is intended primarily as a **reference implementation and research prototype** demonstrating how interactive mapping, routing, and survey components can be combined for travel behaviour research. It is not intended to be a production-ready, general-purpose survey platform.

## Example implementation

The Toronto implementation asks participants to:

1. provide basic information about their trip;
2. select an origin and destination using an interactive map;
3. review routes generated for their trip;
4. identify their current travel behaviour;
5. compare existing and future transportation alternatives; and
6. answer follow-up questions about their preferences and the factors influencing their choices.

The implementation was developed around planned changes to Toronto's transit network, including the **Eglinton Crosstown LRT** and **Finch West LRT**. The same underlying approach could be adapted to other transportation projects, networks, or stated/revealed-preference research designs.

## Research purpose

The project explores the use of interactive trip-planning tools as a survey interface for transportation research.

The broader approach is intended to make it possible to construct survey questions around trips and alternatives that are directly relevant to individual respondents. Routing and network data can be used to generate realistic alternatives and associated attributes, while the web interface provides respondents with a familiar way to identify and evaluate those alternatives.

Potential applications include:

* stated- and revealed-preference data collection;
* before-and-after studies of transportation interventions;
* evaluation of proposed transit infrastructure or service changes;
* mode-choice and route-choice research;
* longitudinal follow-up studies;
* public-facing transportation research and engagement; and
* collection of behavioural data for discrete choice and related models.

This repository demonstrates one implementation of that concept rather than prescribing a particular survey design.

## Application architecture

The example implementation combines several components:

* **React** for the survey and user interface;
* **React Leaflet** for interactive mapping;
* **OpenTripPlanner (OTP)** for transit routing;
* external geocoding and road-routing services where required; and
* **Supabase** for storing survey responses.

The application separates the participant-facing survey interface from the routing and data services used to construct travel alternatives. This allows the survey design, transportation networks, routing engines, and data-storage infrastructure to be modified independently for other applications.

## Repository structure

Key application files are contained in `src/`:

* `pages/` – survey pages, including the landing page, mapping interface, privacy information, and exit survey;
* `App.js` – application routing and main entry point;
* `supabaseClient.js` – Supabase client configuration.

Static assets and the application shell are contained in `public/`.

Additional scripts, including `preprocess-gtfs.js`, support preparation of transportation network data used by the application.

## Getting started

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

Create a `.env` file in the project root and provide the required Supabase credentials:

```env
REACT_APP_SUPABASE_URL=<your-supabase-url>
REACT_APP_SUPABASE_KEY=<your-supabase-anon-key>
```

Depending on the functionality being used, additional configuration may be required for routing, geocoding, or other external services.

### 3. Start the development server

```bash
npm start
```

The application will be available at:

```text
http://localhost:3000
```

## Available scripts

### `npm start`

Runs the application in development mode.

### `npm test`

Runs the test suite. Set `CI=true` to run the tests once rather than in interactive watch mode.

### `npm run build`

Creates an optimized production build in the `build/` directory.

## GTFS preprocessing

The optional `preprocess-gtfs.js` script can be used to prepare GTFS data for visualization within the application.

The script processes GTFS route, trip, and shape data and produces a compressed JSON representation suitable for use by the mapping interface.

This preprocessing is separate from the routing network used by OpenTripPlanner.

## Adapting the implementation

The Toronto application should be treated as an example of the broader survey approach. Researchers wishing to reuse it will generally need to modify:

* survey questions and participant flow;
* study-area map configuration;
* GTFS and other transportation network data;
* OpenTripPlanner instances and routing configuration;
* geocoding and road-routing services;
* database schema and data-storage configuration;
* attributes presented to respondents; and
* consent, privacy, and research-ethics materials.

The codebase is therefore best understood as a starting point for developing project-specific implementations rather than a deployable survey product requiring only configuration changes.

## Research and citation

This repository accompanies research on the use of interactive trip-planning interfaces for transportation survey and travel-behaviour data collection.

**Citation information will be added following publication.**

If you use or adapt this implementation for academic research, please cite the associated publication once available.

## Status

This repository represents a research prototype developed for an active transportation research project. Components may change as the methodology and Toronto case study continue to be developed.

## License

See the repository license for terms governing reuse and modification.
