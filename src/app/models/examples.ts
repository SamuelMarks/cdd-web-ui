/**
 * Example OpenAPI specifications for the editor.
 * @module models/examples
 */

/**
 * A sample OpenAPI specification for a pet store.
 */
export const PETSTORE_SPEC = `openapi: 3.0.0
info:
  /** title */
  title: Swagger Petstore
  /** version */
  version: 1.0.0
servers:
  - url: http://petstore.swagger.io/v1
paths:
  /pets:
    /** get */
    get:
      summary: List all pets
      operationId: listPets
      responses:
        '200':
          description: A paged array of pets
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Pets'
    /** post */
    post:
      summary: Create a pet
      operationId: createPets
      responses:
        '201':
          description: Null response
components:
  /** schemas */
  schemas:
    /** Pet */
    Pet:
      type: object
      required:
        - id
        - name
      properties:
        id:
          type: integer
          format: int64
        name:
          type: string
        tag:
          type: string
    /** Pets */
    Pets:
      type: array
      items:
        $ref: '#/components/schemas/Pet'`;

/**
 * A sample OpenAPI specification for a basic "Hello World" API.
 */
export const HELLO_WORLD_SPEC = `openapi: 3.0.0
info:
  /** title */
  title: Hello World API
  /** version */
  version: 1.0.0
paths:
  /hello:
    /** get */
    get:
      summary: Returns a greeting
      responses:
        '200':
          description: A simple greeting
          content:
            text/plain:
              schema:
                type: string
                example: Hello, World!`;
