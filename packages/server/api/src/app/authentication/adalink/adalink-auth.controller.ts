import { securityAccess } from '@activepieces/server-shared'
import { Static, Type } from '@sinclair/typebox'
import { FastifyPluginAsyncTypebox } from '@fastify/type-provider-typebox'
import { adalinkAuthService } from './adalink-auth.service'

const AdalinkAuthRequest = Type.Object({
    token: Type.String(),
})

type AdalinkAuthRequestType = Static<typeof AdalinkAuthRequest>

export const adalinkAuthController: FastifyPluginAsyncTypebox = async (app) => {
    app.post('/adalink/authenticate', {
        config: {
            security: securityAccess.public(),
        },
        schema: {
            body: AdalinkAuthRequest,
        },
    }, async (request, reply) => {
        const { token } = request.body as AdalinkAuthRequestType

        try {
            const payload = await adalinkAuthService(request.log).verifyAdalinkToken(token)
            const result = await adalinkAuthService(request.log).getOrCreateUserAndProject(payload)

            return reply.send(result)
        }
        catch (error) {
            request.log.error({ error }, 'Adalink authentication failed')
            return reply.status(401).send({
                error: 'Unauthorized',
                message: 'Invalid Adalink token',
            })
        }
    })

    app.get('/adalink/health', {
        config: {
            security: securityAccess.public(),
        },
    }, async (_request, reply) => {
        return reply.send({
            status: 'ok',
            service: 'adalink-auth',
            timestamp: new Date().toISOString(),
        })
    })
}
