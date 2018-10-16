import {
    IFieldPossiblePayload,
    IFieldProcessingData,
    SchemaPayloadGenerator
} from "../schemaPayloadGenerator";

abstract class BaseFieldProcessor {
    protected readonly generator: SchemaPayloadGenerator;
    public constructor(generator: SchemaPayloadGenerator) {
        if (generator === undefined) throw new Error('Must initialize with the calling value generator');
        this.generator = generator;
    }

    public abstract async generateFieldPayloads(field: IFieldProcessingData): Promise<IFieldPossiblePayload[]>;

    protected rawValuesToPossiblePayloads(rawValues: any[], field: IFieldProcessingData): IFieldPossiblePayload[] {
        return rawValues.map((payload, index) => ({field, payload, id: this.generatePayloadID(field, index)}));
    }

    protected generatePayloadID(field: IFieldProcessingData, payloadIndex: number): string {
        if (payloadIndex < 0) throw new Error(`Payload index must be > 0 (sent ${payloadIndex})`);
        return `${field.fieldFullPath}:${payloadIndex}`;
    }
}

export {BaseFieldProcessor};

