import { EngineResponseStatus, ExecuteActionResponse, isNil, WorkerJobType } from '@activepieces/shared'
import { FastifyBaseLogger } from 'fastify'
import { OperationResponse } from 'server-worker'
import { userInteractionWatcher } from '../../workers/user-interaction-watcher'
import { appConnectionService } from '../../app-connection/app-connection-service/app-connection-service'
import { pieceMetadataService } from '../metadata/piece-metadata-service'

const DEFAULT_TIMEOUT_SECONDS = 60

type ExecutePieceActionParams = {
    pieceName: string
    actionName: string
    pieceVersion: string
    input: Record<string, unknown>
    connectionId?: string
    projectId: string
    platformId: string
}

export const pieceExecuteService = (log: FastifyBaseLogger) => ({
    async execute(params: ExecutePieceActionParams): Promise<ExecuteActionResponse> {
        const {
            pieceName,
            actionName,
            pieceVersion,
            input,
            connectionId,
            projectId,
            platformId,
        } = params

        // Get the piece metadata to validate it exists
        const pieceMetadata = await pieceMetadataService(log).getOrThrow({
            name: pieceName,
            version: pieceVersion,
            platformId,
        })

        // Validate the action exists
        const action = pieceMetadata.actions[actionName]
        if (isNil(action)) {
            return {
                success: false,
                input,
                output: null,
                message: `Action '${actionName}' not found in piece '${pieceName}'`,
            }
        }

        // If connectionId is provided, get the connection value and add to input
        let resolvedInput = { ...input }
        if (!isNil(connectionId)) {
            const connection = await appConnectionService(log).getOneOrThrow({
                id: connectionId,
                projectId,
            })
            resolvedInput = {
                ...resolvedInput,
                auth: connection.value,
            }
        }

        // Execute the action using the worker
        try {
            const { result, status } = await userInteractionWatcher(log).submitAndWaitForResponse<OperationResponse<ExecuteActionResponse>>({
                jobType: WorkerJobType.EXECUTE_PIECE_ACTION,
                platformId,
                projectId,
                pieceName,
                pieceVersion,
                actionName,
                input: resolvedInput,
            })

            if (status !== EngineResponseStatus.OK) {
                return {
                    success: false,
                    input,
                    output: null,
                    message: `Engine returned status: ${status}`,
                }
            }

            return result
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error)
            log.error({ error, params }, 'Failed to execute piece action')
            return {
                success: false,
                input,
                output: null,
                message: errorMessage,
            }
        }
    },
})
