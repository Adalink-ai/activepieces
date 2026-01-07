import { api } from '@/lib/api';
import { ManagedAuthnRequestBody } from '@activepieces/ee-shared';
import { AuthenticationResponse } from '@activepieces/shared';

export const managedAuthApi = {
  generateApToken: async (request: ManagedAuthnRequestBody) => {
    // Usa endpoint Adalink customizado para autenticação
    return api.post<AuthenticationResponse>(
      `/v1/adalink/authenticate`,
      { token: request.externalAccessToken },
    );
  },
};
