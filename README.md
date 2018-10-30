# Schema Payload Generator

[![Build Status](https://travis-ci.org/yaronassa/SchemaPayloadGenerator.svg?branch=master)](https://travis-ci.org/yaronassa/SchemaPayloadGenerator) 
[![Coverage Status](https://coveralls.io/repos/github/yaronassa/SchemaPayloadGenerator/badge.svg?branch=master)](https://coveralls.io/github/yaronassa/SchemaPayloadGenerator?branch=master)

[Project on GitHub](https://github.com/yaronassa/SchemaPayloadGenerator)

Schema payload generator allows you to generate all* possible payload combination for objects in your schema.
You can use these payloads for unit/api tests, examples, etc.

(* Well, obviously not *ALL* possibilities, but multiple values per field, with cumulative combinations for arrays and objects)

Working with ProtoBuff? FastBuffers? XML schemas? Just convert them to JSONSchema and you're good to go

## TL;DR

**Install**

``` shell
$ npm install schema-payload-generator
```

**Generate payloads**

```javascript
import {SchemaPayloadGenerator} from 'schema-payload-generator'
const generator = new SchemaPayloadGenerator();
await generator.loadSchema(mySchemaPathOrObject);
const possibilities = await generator.generatePayloads();
```

**Test/Use**

```javascript
console.log(`TEST ALL THE THINGS!`);
for (const possibility of possibilities) {
    await myAPIClient.get(possibility.payload);
}
```

## Documentation

Project code documentation is available at the [github page](https://yaronassa.github.io/SchemaPayloadGenerator/).

The feature roadmap is available in the [roadmap github board](https://github.com/yaronassa/SchemaPayloadGenerator/projects/1).

## Out-Of-The-Box usage

### Loading a schema
Using schema payload generator always starts with loading a quasi-valid schema object. It doesn't have to be a full-blown by-the-book schema (though it can be) - even fragements lik e `{type: 'boolean'}` can work.

**Please note** Like the value generation itself, the [`.loadSchema`](https://yaronassa.github.io/SchemaPayloadGenerator/classes/schemapayloadgenerator.html#loadschema) command is asynchronous and returns a `Promise`.

```javascript
import {SchemaPayloadGenerator} from 'schema-payload-generator'
const generator = new SchemaPayloadGenerator();
await generator.loadSchema({type: 'object', properties: {myBool: {type: 'boolean'}}});
```

Alternatively You can send a relative path to a an external file that will be required.

```javascript
await generator.loadSchema('./pathToFile.json');
```

The schema will be parsed by [JSON Schema $Ref Parser](https://www.npmjs.com/package/json-schema-ref-parser), and can receive an [options object](https://github.com/APIDevTools/json-schema-ref-parser/blob/master/docs/options.md) that will be passed directly to the parser.

```javascript
await generator.loadSchema('./pathToFile.json', {dereference: {circular: false}});
``` 

The parser will resolve all local / remote references, $ref values, etc, so you don't need to prepare / change your schemas.

### Predicting value count

For large and complex schemas, the value generation process maybe extremely lengthy, and you might want to get a general sense of the expected payload count, before actually generating them.

the `.calculatePayloadCount` method will do just that. It will attempt to short-circut many of the length generation process, where applicable, and quickly produce the expected payload count.

All of the value generation customizations will be used, so you'll get an acurate prediction. This means, however, that if your customizations involve [producing your own values](##custom-type-specific-generators) for object / array type fields, or limiting their value generations through [custom functions](###value-combination-tweaks), `calculatePayloadCount` won't be much quicker than the actual value generation.

This is because much of the "short-circuts" `calculatePayloadCount` uses regard the generic object and array value generations. If they are customized, the actual value generation will be run to determine the expected payload count.

### Generating values

**Please note** Like the schema loading operations, the [`.generatePayloads`](https://yaronassa.github.io/SchemaPayloadGenerator/classes/schemapayloadgenerator.html#generatepayloads) command is asynchronous and returns a `Promise`. 

Once a schema is loaded, generating values is straightforward:

```javascript
const possibilities = await generator.generatePayloads();

/*
* possibilities is an array of IFieldPossiblePayload:
* {
*   field: JSON6Schema 	// The original schema field
*   payload: any 		// The actual generated payload to be used
*   parentPossiblePayload?: IFieldPossiblePayload // The base-payload this one extends
* }
*/
```

In case the loaded schema contains many definitions and no main object (usually the case for API specs), you'll need to pass the relevant definition key.

```javascript
const possibilities = await generator.generatePayloads('key_under_definitions_schema_node');
```

#### Default generated values

By default, the generator will generate value possibilities according to the object types (read about [more flexible customizations](#customising-value-generation) below).

The values generated by default are:

| Type | Generated Values | Remarks|
|---|---|---|
|Boolean| `[true, false]`| |
|Integer| `[min, max, between]` | Min = as set by minimum. Defaults to 1. <br/> Max = as set by maximum. Defaults to 100. <br/> Between = a random number between min and max.
|Number| `[min, max, between]` | Treated as Integer
|String| `["Value"]` | Actual value produced by [https://github.com/json-schema-faker/json-schema-faker](json-schema-faker) |
|Field w/ enum| `[enum value, enum value]` | The returned array includes all values |
|Array| `[[values], [values]]` | The values are all of the array's inner type value possibilities as well as all their [pairwise combinations](https://en.wikipedia.org/wiki/All-pairs_testing)|
|Object| `[{payload:1}, {payload:2}]` | All the possibles payload combinations according to the object's `.properties` and `.required` properties|

At the end, the value-generations is always done for a root Object type field (The schema / one of its definitions). All the "leafs" fields are flattened out to JSON payloads, and so on until an array of root-level JSON payloads is returned.

These default values can be manipulated and overriden, as explained below.

#### Limiting variations

For simple schemas, the TD;LR version is enough. You load the schema, produce ~100 or so payload variations, and go on with your business.

For complex schemas, however, the variation count will exponentially "exlode" and become unusable. Even a seemingly simple schema with a few well place `$ref` pointers can explode into many millions / billions of variations. Usually node will break before you do, but even if node doesn't crash on an out-of-memory error, that much data (and the runtime needed to produce it) will prove unusable.

So, you'll have to limit the generated variations in some manner. This can be done through three mechanisms.

- Override the value-generation for some of the types (e.g., make enum fields return only some of the variations).
- Create other mechanisms to generate specific values, or even surpress value generation altogether (e.g. do no produce values for fields in a given object path / with a specific title)
- Tweak the way value-combinations are generated (e.g. instead of creating a full pairwise array for big enums, take maximum 5 pair-combinations).

All these are covered in the following section [Customising value generation](#customising-value-generation).

## Customising value generation

### Value combination tweaks

There are several field types that are responsible for combining values and generating massive amounts of these combinations. Specifically, array-type and object-type fields "explode" their inner-fields variations into multiple combinations. By tweaking these combination tweaks, you can significantly reduce the number of produce value variations.

#### Arrays

The default processing for an array field is to include each of its sub-field possible values, as well as every non-repeating-pair-combination between these values. So the schema field `{type: 'array', items: {type: 'boolean'}}` will produce these possible sub-field values: `[true, false]`. These will be exploded into the array possibilities of `[[true], [false], [true, false]]`. Every value is included once, then every value pair.

This may not seem that bad, but imagine an array of an enum field with 8 possible values. The array possible values count will be 8 original values + 7 pairs for the 1st value + 6 for the 2nd + ... + 1 pair for the 7th = **total of 36 value combinations**.

You can control and limit the way these variations are generated via the `combinations.arrays` field in the generator options.

**maxCombinations**:

Set `arrays.maxCombinations` to an integer to crudly truncate the array possible values. The remaining values may or may not include the original single-values, dependent on how much was trunced. 

**combinationGenerator**:

For even more control, set this option to your custom function, and generate the value combinations yourself. Returning an undefined result will fallback to the default behaviour:

```javascript
const customCombinationGenerator = (field: IFieldProcessingData, subFieldRawValues: any[]): any[][] => {
   // Return your values here.
   // Remember, it should be an array of arrays
   // For example
   return subFieldRawValues.reverse().map(item => [item]);
};
```

#### Objects

The default processing for an object field is to get all possible variations for all property fields, than build every possible variation combination between all the properties (non-mandatory properties are added an `undefined` possible value for the combination matrix).

Understandably, this process creates **huge** amounts of payload variations. An object field with 5 properties can easily have a few hundred payload variations, a few thousands if some of those are array properties. Given this, the limit mechanisms for object combinations are more substantial.

**maxPropertyCombinations**:

Set `objects.maxPropertyCombinations` to an integer to crudly truncate each object property possible values, before they are combined in the object payloads. This does **not** affect non-mandatory fields gaining the additional `undefined` option.

e.g. if an object has a boolean property, setting `maxPropertyCombinations` to 1, will cause the boolean property to contribute only 1 possibility to the payload combinations matrix (compared to the 2 it usually does). The total payload count for that object may still be very high.

**maxObjectPayloadCombinations**:

Set `objects.maxObjectPayloadCombinations` to an integer to crudly truncate the object's generated payloads count.

e.g. if an object have a boolean property and a string property, setting `maxObjectPayloadCombinations` to 1, will cause the object to have only 1 possible payload (compared to the 6 - *2 + undefined for the boolean X 1 + undefined for the string*) it usually does).

**minimalPayloadCombinationGenerator**:

For even more control, set this option to your custom function, and generate the value combinations yourself. This function is responsible for generating the minimial payloads, i.e. payloads that contain all the required fields. Returning an undefined result will fallback to the default behaviour:


```javascript
const customMinimalPayloadCombinationGenerator = (objectField: IFieldProcessingData, requiredPropertiesPossibilities: {[key: string]: IFieldPossiblePayload[]}): any[] => {
   // Return your payloads here.
   // Remember, EVERY payload MUST include all properties (they are required)
   // For example - return 1 payload with the 1st possibility from each property
   
   const payload = {};
   Object.keys(requiredPropertiesPossibilities).forEach(propertyKey => {
	   payload[propertyKey] = requiredPropertiesPossibilities[propertyKey][0].payload;
   });
   
   return [payload];
};
```


**optionalPayloadCombinationsGenerator**:
This function is responsible for enriching each minimal payload with non-mandatory fields. 
Each payload this funciton returns will be combined with **all** the minimal payloads. So if the function returns 3 payload possibilities for the optional fields, and there are 2 minimal payload possibilities, we'll get a total of 2X4 (3 + undefined)=8 payload possibilities.
Returning an undefined result will fallback to the default behaviour.

```javascript
const customOptionalPayloadCombinationGenerator = (field: IFieldProcessingData, generatedMinimalPayloads: IFieldPossiblePayload[], optionalPropertiesPossibilities: {[key: string]: IFieldPossiblePayload[]}): any[] => {
   // Return your payloads here.
   // No need to return the undefined payload - it will be added automatically
   // For example - return 1 payload with the 1st possibility from each property
   
   const payload = {};
   Object.keys(optionalPropertiesPossibilities).forEach(propertyKey => {
	   payload[propertyKey] = optionalPropertiesPossibilities[propertyKey][0].payload;
   });
   
   return [payload];
};
```

### Custom type-specific generators

This mechanism allows you to quickluy generate your own values for a specific schema type, via the [`customTypeProcessors`](https://yaronassa.github.io/SchemaPayloadGenerator/interfaces/ischemapayloadgeneratoroptions.html#customtypeprocessors) field of the generator options object. For example, you might want to generate URIs in a given domain for a string URI value, or to always output the title of the field as its value. Just prepare a function that recieves the field schema object, and returns a promise that resolves to an array of raw-values, and you're good to go.

```javascript
const newStringProcessor = async (fieldSchema) => fieldSchema.title;
const generator = new SchemaPayloadGenerator({options: {customTypeProcessors: {string: newStringProcessor}}});
await generator.loadSchema({type: 'string', title: 'myTitle'});
const payloads = await generator.generatePayloads();

console.log(payloads[0].payload); // output = 'myTitle'
```

(of course you can have many type processors for any possible type).

The entire value generation mechansim is asynchronous to allow for complex customizations (you can query a DB / API to generate values, have your own caches and enums, etc.).

### Custom general generators

Customizing the value generation for specific types is great, but you may want to control the value generation in a more nuanced manner. This requires a broader context, as well as the ability to inspect a field, without commiting to change its values beforehand.

This can be achieved via the [`customFieldProcessors`](https://yaronassa.github.io/SchemaPayloadGenerator/interfaces/ischemapayloadgeneratoroptions.html#customfieldprocessors) field of the generator options object. This field can be set to an array of custom processing functions, that will each be called in order. Each function can inspect the field and its context, and either return the values for the field, or `undefined`. If a function doesn't return values, the next funciton in line is called. If all custom functions are exausted, the generator will continue its regular generating process (including calling custom type-specific funciton, etc.).

These functions get a much broader context than the type-specific custom function:

```typescript
(field: IFieldProcessingData, entireSchema: JSONSchema6, processorClass: CustomFieldProcessor) => Promise<any[]>;
```

Where the `field` parameter include the field's schema, parent, key name in parent and its full path; and the `processorClass` parameter is the `CustomFieldProcessor` class, which allows access to the generator, options, and other utility functions.

**For example**: 

```javascript
const disallowFields = async (field, entireSchema, processorClass) => {
	if (field.fieldFullPath === '/some/property/path') return [];
	if (/^disallowedPrefix/i.test(field.schema.title)) return [];
}

const allowSpecificField = async (field, entireSchema, processorClass) => {
	if (field.schema.title === 'disallowedPrefix but include this one') return ['A value'];
}
const generator = new SchemaPayloadGenerator({customFieldProcessors: [disallowFields, allowSpecificField]});
await generator.loadSchema({type: 'string', title: 'disallowedPrefix but include this one'});
let payloads = await generator.generatePayloads();

console.log(payloads[0].payload); // output = 'A value'

await generator.loadSchema({type: 'string', title: 'disallowedPrefix'});
payloads = await generator.generatePayloads();

console.log(payloads.length); // output = 0

await generator.loadSchema({type: 'string', title: 'Other title'});
payloads = await generator.generatePayloads();

console.log(payloads[0].payload); // output = regular random output for a string value

```

The custom processors are executed in reverse order, so once `allowSpecificField`catches field in the 1st generation, it returns the payload `['A value']`.
In the 2nd generation, the field slips by, and is caught by `disallowFields`, and 0 payloads are returned.
Any other field will have these functions return `undefined`, and the payloads will be generated as usual.
 

## Further customizations

Schema payload generator was built with user-customization in mind. Beside the build-in customization mechanisms described above, all the classes were build to be inherited and extended.

You'll find that all of the inner properties and methods that're relevant to value generation and field processing are `protected` (rather than `private`), to facilitate extending the class and overriding its members.

Similaraly, the field processing classes extend a base class, which can be extended to achieve new functionality.






