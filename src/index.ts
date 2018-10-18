/**
 * One-Stop-Shop for all the classes, interfaces and types
 */

import {SchemaPayloadGenerator, IFieldProcessingData, IFieldPossiblePayload, ISchemaPayloadGeneratorOptions} from "./schemaPayloadGenerator";
import {CustomFieldProcessor, CustomProcessorFunction} from "./schemaFieldProcessors/customFieldProcessor";
import {BaseFieldProcessor} from "./schemaFieldProcessors/baseFieldProcessor";
import {TypeFieldProcessor} from "./schemaFieldProcessors/typeFieldProcessor";

export {
    SchemaPayloadGenerator, IFieldProcessingData, IFieldPossiblePayload, ISchemaPayloadGeneratorOptions,
    CustomFieldProcessor, CustomProcessorFunction,
    BaseFieldProcessor,
    TypeFieldProcessor
};
