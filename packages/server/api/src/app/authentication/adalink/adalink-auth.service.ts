import { apId, AuthenticationResponse, PlatformRole, PrincipalType, ProjectType, UserIdentityProvider, UserStatus } from '@activepieces/shared'
import { FastifyBaseLogger } from 'fastify'
import jwtLibrary from 'jsonwebtoken'
import { platformService } from '../../platform/platform.service'
import { projectService } from '../../project/project-service'
import { userService } from '../../user/user-service'
import { accessTokenManager } from '../lib/access-token-manager'
import { userIdentityService } from '../user-identity/user-identity-service'

const ADALINK_JWT_SECRET = process.env.ADALINK_JWT_SECRET || 'adalink-secret-key'

export interface AdalinkJwtPayload {
    sub: string
    email: string
    name: string
    organizationId: string
    organizationName: string
    iat?: number
    exp?: number
}

export const adalinkAuthService = (log: FastifyBaseLogger) => ({
    async verifyAdalinkToken(token: string): Promise<AdalinkJwtPayload> {
        try {
            const decoded = jwtLibrary.verify(token, ADALINK_JWT_SECRET) as AdalinkJwtPayload
            return decoded
        }
        catch (error) {
            log.error({ error }, 'Failed to verify Adalink JWT')
            throw new Error('Invalid Adalink token')
        }
    },

    async getOrCreateUserAndProject(payload: AdalinkJwtPayload): Promise<AuthenticationResponse> {
        const { email, name, organizationId, organizationName } = payload
        const [firstName, ...lastNameParts] = name.split(' ')
        const lastName = lastNameParts.join(' ') || firstName

        // Criar identificador único para a plataforma baseado no organizationId
        const platformIdentifier = `adalink-${organizationId}`

        let platform = await this.findPlatformByIdentifier(platformIdentifier)

        if (!platform) {
            log.info({ organizationId, organizationName }, 'Creating new platform for Adalink organization')
            platform = await this.createPlatformForOrganization(platformIdentifier, organizationName, log)
        }

        let identity = await userIdentityService(log).getIdentityByEmail(email)

        if (!identity) {
            log.info({ email }, 'Creating new identity for Adalink user')
            identity = await userIdentityService(log).create({
                email,
                firstName,
                lastName,
                password: apId(),
                trackEvents: false,
                newsLetter: false,
                provider: UserIdentityProvider.JWT,
                verified: true,
            })
        }

        let user = await userService.getOneByIdentityAndPlatform({
            identityId: identity.id,
            platformId: platform.id,
        })

        if (!user) {
            log.info({ email, platformId: platform.id }, 'Creating new user for Adalink')
            user = await userService.create({
                identityId: identity.id,
                platformId: platform.id,
                platformRole: PlatformRole.ADMIN,
                externalId: payload.sub,
            })
        }

        // Buscar projeto existente ou criar novo
        let project = await this.findProjectForUser(user.id, platform.id)

        if (!project) {
            log.info({ userId: user.id, platformId: platform.id }, 'Creating new project for Adalink user')
            project = await projectService.create({
                displayName: `${organizationName} - Automações`,
                ownerId: user.id,
                platformId: platform.id,
                type: ProjectType.TEAM,
            })
        }

        const token = await accessTokenManager.generateToken({
            id: user.id,
            type: PrincipalType.USER,
            platform: {
                id: platform.id,
            },
            tokenVersion: identity.tokenVersion,
        })

        // Retornar no formato AuthenticationResponse esperado pelo frontend
        return {
            id: user.id,
            platformRole: user.platformRole,
            status: user.status ?? UserStatus.ACTIVE,
            externalId: user.externalId,
            platformId: platform.id,
            verified: identity.verified,
            firstName: identity.firstName,
            lastName: identity.lastName,
            email: identity.email,
            trackEvents: identity.trackEvents,
            newsLetter: identity.newsLetter,
            token,
            projectId: project.id,
        }
    },

    async findPlatformByIdentifier(identifier: string) {
        const platforms = await platformService.getAll()
        // Busca plataforma pelo nome que contém o identificador Adalink
        return platforms.find(p => p.name.includes(identifier)) || null
    },

    async findProjectForUser(userId: string, platformId: string) {
        return projectService.getOneByOwnerAndPlatform({
            ownerId: userId,
            platformId,
        })
    },

    async createPlatformForOrganization(identifier: string, organizationName: string, log: FastifyBaseLogger) {
        // Criar identidade de sistema para ser o owner da plataforma
        const systemEmail = `system-${identifier}@adalink.internal`

        let systemIdentity = await userIdentityService(log).getIdentityByEmail(systemEmail)

        if (!systemIdentity) {
            systemIdentity = await userIdentityService(log).create({
                email: systemEmail,
                firstName: 'System',
                lastName: organizationName,
                password: apId(),
                trackEvents: false,
                newsLetter: false,
                provider: UserIdentityProvider.JWT,
                verified: true,
            })
        }

        const systemUser = await userService.create({
            identityId: systemIdentity.id,
            platformId: null,
            platformRole: PlatformRole.ADMIN,
        })

        // Nome da plataforma inclui o identifier para facilitar busca
        const platformName = `${organizationName} [${identifier}]`

        const platform = await platformService.create({
            ownerId: systemUser.id,
            name: platformName,
        })

        await userService.addOwnerToPlatform({
            id: systemUser.id,
            platformId: platform.id,
        })

        log.info({ platformId: platform.id, platformName }, 'Platform created for Adalink organization')

        return platform
    },
})
