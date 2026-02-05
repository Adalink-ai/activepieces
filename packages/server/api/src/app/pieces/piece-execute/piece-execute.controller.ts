import { ProjectResourceType, securityAccess } from '@activepieces/server-shared'
import {
    ExecuteActionResponse,
    PrincipalType,
    SERVICE_KEY_SECURITY_OPENAPI,
} from '@activepieces/shared'
import { Type } from '@sinclair/typebox'
import { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox'
import { pieceExecuteService } from './piece-execute.service'

export const pieceExecuteModule: FastifyPluginAsyncTypebox = async (app) => {
    await app.register(pieceExecuteController, { prefix: '/v1/pieces' })
}

const pieceExecuteController: FastifyPluginAsyncTypebox = async (app) => {
    app.post(
        '/*/actions/*/execute',
        ExecutePieceActionRequest,
        async (req): Promise<ExecuteActionResponse> => {
            // Extract pieceName and actionName from wildcard params
            const wildcards = (req.params as any)['*'] as string[]
            const pieceName = wildcards[0]
            const actionName = wildcards[1]

            const { input, pieceVersion, connectionId, projectId: bodyProjectId } = req.body
            const projectId = bodyProjectId ?? req.projectId
            const platformId = req.principal.platform.id

            return pieceExecuteService(req.log).execute({
                pieceName,
                actionName,
                pieceVersion,
                input: input ?? {},
                connectionId,
                projectId,
                platformId,
            })
        },
    )
}

const ExecutePieceActionRequest = {
    config: {
        security: securityAccess.project(
            [PrincipalType.USER, PrincipalType.SERVICE],
            undefined,
            { type: ProjectResourceType.BODY }
        ),
    },
    schema: {
        tags: ['pieces'],
        description: 'Execute a piece action directly without a flow',
        params: Type.Object({
            pieceName: Type.String({
                description: 'The name of the piece (e.g., @activepieces/piece-notion)',
            }),
            actionName: Type.String({
                description: 'The name of the action to execute',
            }),
        }),
        body: Type.Object({
            pieceVersion: Type.String({
                description: 'The version of the piece',
            }),
            input: Type.Optional(Type.Record(Type.String(), Type.Unknown())),
            connectionId: Type.Optional(Type.String({
                description: 'The connection ID to use for authentication',
            })),
            projectId: Type.Optional(Type.String({
                description: 'The project ID (optional, defaults to the authenticated user\'s project)',
            })),
        }),
        security: [SERVICE_KEY_SECURITY_OPENAPI],
        response: {
            200: Type.Object({
                success: Type.Boolean(),
                input: Type.Unknown(),
                output: Type.Unknown(),
                message: Type.Optional(Type.String()),
            }),
        },
    },
}
