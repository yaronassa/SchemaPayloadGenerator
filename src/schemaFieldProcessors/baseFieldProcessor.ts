import {
    IFieldPossiblePayload,
    IFieldProcessingData,
    SchemaPayloadGenerator
} from "../schemaPayloadGenerator";

/**
 * Base template for classes that generate values for fields
 */
abstract class BaseFieldProcessor {
    protected readonly generator: SchemaPayloadGenerator;
    protected constructor(generator: SchemaPayloadGenerator) {
        if (generator === undefined) throw new Error('Must initialize with the calling value generator');
        this.generator = generator;
    }

    /**
     * Actually generate values for the given fields
     * @param field The field to process
     */
    public abstract async generateFieldPayloads(field: IFieldProcessingData): Promise<IFieldPossiblePayload[]>;

    /**
     * Wraps raw generated values into possible payload objects that can be used further down the line
     * @param rawValues The generated values
     * @param field The field being processed
     */
    protected rawValuesToPossiblePayloads(rawValues: any[], field: IFieldProcessingData): IFieldPossiblePayload[] {
        return rawValues.map((payload, index) => ({field, payload, id: this.generatePayloadID(field, index)}));
    }

    /**
     * Generate unique IDs for a payload possibility
     * @param field The field being processed
     * @param payloadIndex The payload index from the available possibilities
     */
    protected generatePayloadID(field: IFieldProcessingData, payloadIndex: number): string {
        if (payloadIndex < 0) throw new Error(`Payload index must be > 0 (sent ${payloadIndex})`);
        return `${field.fieldFullPath}:${payloadIndex}`;
    }
}

export {BaseFieldProcessor};

