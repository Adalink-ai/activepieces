import {
    ActionContext,
    backwardCompatabilityContextUtils,
    InputPropertyMap,
    PieceAuthProperty,
    PiecePropertyMap,
    StaticPropsValue,
} from '@activepieces/pieces-framework'
import {
    AUTHENTICATION_PROPERTY_NAME,
    EngineResponse,
    EngineResponseStatus,
    ExecuteActionResponse,
    ExecutePieceActionOperation,
    ExecutionType,
    isNil,
} from '@activepieces/shared'
import { ToolSet } from 'ai'
import { EngineConstants } from '../handler/context/engine-constants'
import { pieceLoader } from '../helper/piece-loader'
import { createFlowsContext } from '../services/flows.service'
import { createFilesService } from '../services/step-files.service'
import { createContextStore } from '../services/storage.service'
import { agentTools } from '../tools'
import { utils } from '../utils'
import { createPropsResolver } from '../variables/props-resolver'
import { propsProcessor } from '../variables/props-processor'

export const pieceActionOperation = {
    execute: async (operation: ExecutePieceActionOperation): Promise<EngineResponse<ExecuteActionResponse>> => {
        try {
            const constants = EngineConstants.fromExecutePieceActionInput(operation)

            const { pieceAction, piece } = await pieceLoader.getPieceAndActionOrThrow({
                pieceName: operation.pieceName,
                pieceVersion: operation.pieceVersion,
                actionName: operation.actionName,
                devPieces: EngineConstants.DEV_PIECES,
            })

            // Resolve input with connection if provided
            const resolvedInput = { ...operation.input }

            // Process and validate input
            const { processedInput, errors } = await propsProcessor.applyProcessorsAndValidators(
                resolvedInput,
                pieceAction.props,
                piece.auth,
                pieceAction.requireAuth,
                {},
            )

            if (Object.keys(errors).length > 0) {
                return {
                    status: EngineResponseStatus.OK,
                    response: {
                        success: false,
                        input: operation.input,
                        output: null,
                        message: `Validation errors: ${JSON.stringify(errors)}`,
                    },
                }
            }

            // Create action context
            const context: ActionContext<PieceAuthProperty, InputPropertyMap> = {
                executionType: ExecutionType.BEGIN,
                resumePayload: {},
                store: createContextStore({
                    apiUrl: constants.internalApiUrl,
                    prefix: '',
                    flowId: 'direct-execution',
                    engineToken: constants.engineToken,
                }),
                output: {
                    update: async () => { },
                },
                flows: createFlowsContext({
                    engineToken: constants.engineToken,
                    internalApiUrl: constants.internalApiUrl,
                    flowId: 'direct-execution',
                    flowVersionId: 'direct-execution',
                }),
                step: {
                    name: operation.actionName,
                },
                auth: processedInput[AUTHENTICATION_PROPERTY_NAME],
                files: createFilesService({
                    apiUrl: constants.internalApiUrl,
                    engineToken: constants.engineToken,
                    stepName: operation.actionName,
                    flowId: 'direct-execution',
                }),
                server: {
                    token: constants.engineToken,
                    apiUrl: constants.internalApiUrl,
                    publicUrl: constants.publicApiUrl,
                },
                agent: {
                    tools: async (params): Promise<ToolSet> => agentTools.tools({
                        engineConstants: constants,
                        tools: params.tools,
                        model: params.model,
                    }),
                },
                propsValue: processedInput,
                tags: {
                    add: async () => { },
                },
                connections: utils.createConnectionManager({
                    apiUrl: constants.internalApiUrl,
                    projectId: constants.projectId,
                    engineToken: constants.engineToken,
                    target: 'triggers',
                    contextVersion: piece.getContextInfo?.().version,
                }),
                run: {
                    id: 'direct-execution',
                    stop: () => { },
                    pause: () => { },
                    respond: () => { },
                },
                project: {
                    id: constants.projectId,
                    externalId: constants.externalProjectId,
                },
                generateResumeUrl: () => '',
            }

            const backwardCompatibleContext = backwardCompatabilityContextUtils.makeActionContextBackwardCompatible({
                contextVersion: piece.getContextInfo?.().version,
                context,
            })

            // Execute the action
            const output = await pieceAction.run(backwardCompatibleContext)

            return {
                status: EngineResponseStatus.OK,
                response: {
                    success: true,
                    input: operation.input,
                    output,
                },
            }
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error)
            return {
                status: EngineResponseStatus.OK,
                response: {
                    success: false,
                    input: operation.input,
                    output: null,
                    message: errorMessage,
                },
            }
        }
    },
}
