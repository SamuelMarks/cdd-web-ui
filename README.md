cdd-web-ui
==========

Compiler Driven Development (CDD) is a methodology of rapid application development, that focusses on producing more code; not less.

Rather than some new general purpose language, DSL, or other solution which creates a "generated DO NOT TOUCH" directory, CDD dictates that you follow vendor dictates; i.e., plain old Python `class`es, SQL `CREATE TABLE`s, CLI augmenting parser, etc.

CDD involves the creation of new compiler. To add a language, implement an entire compiler in that new language, that goes to and from OpenAPI.

This project coordinates all known CDD implementations into a web interface.

The idea of the web-interface is that you can

## Features

### Release clients

  0. Provide an OpenAPI spec and produce client libraries in X languages
  1. Release to source repo (e.g., GitHub) and CI to all their app stores (e.g., pypi, crates, Maven Central)

### Release servers

  0. Provide an OpenAPI spec and produce servers in Y languages
  1. Release to source repo (e.g., GitHub) and CI to all their app stores (e.g., pypi, crates, Maven Central)
  2. Serve to [cloud] hosting provider(s)

### Produce UI

  0. Drag-drop UI interface builder, that produces OpenAPI code
  1. Release clients and servers as per above

TODO: Figure out if this can be represented in OpenAPI, their new Arrazo spec, or if it needs an entirely new/different specification language.

If this goes too far then will need to consider:
- Screen sizes and how it reacts to reactivity (unfolding a phone to twice the size, landscape to portrait, resizing a window from 'mobile' to 'desktop'; &etc.)
- Theming (e.g., Material, Cupertino, Fluent; and customisations thereof)

### Generic features

- RBAC
- Social & network auth
- Sharable collaborative programmes with shareable collaborative projects
- Shield to place in GitHub README.md


---

## Other ideas
- Make this site also host the docs
- Make this site also be a CI log aggregator
- Make this site also track deployed versions on different source repos, crates/pypi/etc.
