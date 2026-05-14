import { computed } from 'vue';

export function useEnterpriseAccess() {
  const config = useRuntimeConfig();
  const { session } = useAuth();

  const isEnterprise = computed(() => {
    const publicConfig = config.public as Record<string, unknown>;
    const enabledByEnv = String(publicConfig.enterpriseTools ?? '').toLowerCase() === 'true';
    const enabledBySession = Boolean(session.value?.isEnterprise);
    const enabledByEmail = Boolean(
      session.value?.email?.includes('+enterprise') ||
      session.value?.email?.endsWith('@postfolio.io'),
    );

    return enabledByEnv || enabledBySession || enabledByEmail;
  });

  return { isEnterprise };
}
