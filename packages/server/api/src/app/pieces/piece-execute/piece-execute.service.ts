import { ActivepiecesError, EngineResponseStatus, ErrorCode, ExecuteActionResponse, isNil, WorkerJobType } from '@activepieces/shared'
import { FastifyBaseLogger } from 'fastify'
import { OperationResponse } from 'server-worker'
import { ArrayContains } from 'typeorm'
import { userInteractionWatcher } from '../../workers/user-interaction-watcher'
import { appConnectionService, appConnectionsRepo } from '../../app-connection/app-connection-service/app-connection-service'
import { pieceMetadataService } from '../metadata/piece-metadata-service'

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
            const encryptedConnection = await appConnectionsRepo().findOneBy({
                id: connectionId,
                projectIds: ArrayContains([projectId]),
                platformId,
            })

            if (isNil(encryptedConnection)) {
                throw new ActivepiecesError({
                    code: ErrorCode.ENTITY_NOT_FOUND,
                    params: {
                        entityType: 'AppConnection',
                        entityId: connectionId,
                    },
                })
            }

            const connection = await appConnectionService(log).decryptAndRefreshConnection(
                encryptedConnection,
                projectId,
                log,
            )

            if (isNil(connection)) {
                throw new ActivepiecesError({
                    code: ErrorCode.INVALID_APP_CONNECTION,
                    params: {
                        error: 'Failed to decrypt or refresh connection',
                    },
                })
            }

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
