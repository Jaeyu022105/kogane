interface ModalBaseOptions {
  title?: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmVariant?: 'primary' | 'danger';
}

interface ModalState extends ModalBaseOptions {
  open: boolean;
  kind: 'confirm' | 'alert' | 'custom';
  name: string | null;
  props: Record<string, unknown> | null;
}

type Resolver = ((value: boolean) => void) | null;

export function useModal() {
  const state = useState<ModalState>('kogane:modal:state', () => ({
    open: false,
    kind: 'alert',
    name: null,
    title: undefined,
    description: undefined,
    confirmLabel: 'OK',
    cancelLabel: 'Cancel',
    confirmVariant: 'primary',
    props: null,
  }));
  const resolver = useState<Resolver>('kogane:modal:resolver', () => null);

  function reset() {
    state.value = {
      open: false,
      kind: 'alert',
      name: null,
      title: undefined,
      description: undefined,
      confirmLabel: 'OK',
      cancelLabel: 'Cancel',
      confirmVariant: 'primary',
      props: null,
    };
  }

  function open(name: string, props: Record<string, unknown> = {}, options: ModalBaseOptions = {}) {
    state.value = {
      open: true,
      kind: 'custom',
      name,
      props,
      title: options.title ?? name,
      description: options.description,
      confirmLabel: options.confirmLabel ?? 'Close',
      cancelLabel: options.cancelLabel ?? 'Cancel',
      confirmVariant: options.confirmVariant ?? 'primary',
    };
  }

  function close(result = false) {
    const currentResolver = resolver.value;
    reset();
    if (currentResolver) {
      resolver.value = null;
      currentResolver(result);
    }
  }

  function confirm(options: ModalBaseOptions): Promise<boolean> {
    state.value = {
      open: true,
      kind: 'confirm',
      name: 'confirm',
      props: null,
      title: options.title,
      description: options.description,
      confirmLabel: options.confirmLabel ?? 'Confirm',
      cancelLabel: options.cancelLabel ?? 'Cancel',
      confirmVariant: options.confirmVariant ?? 'primary',
    };

    return new Promise<boolean>((resolve) => {
      resolver.value = resolve;
    });
  }

  function alert(options: Pick<ModalBaseOptions, 'title' | 'description' | 'confirmLabel'>): Promise<boolean> {
    state.value = {
      open: true,
      kind: 'alert',
      name: 'alert',
      props: null,
      title: options.title,
      description: options.description,
      confirmLabel: options.confirmLabel ?? 'OK',
      cancelLabel: 'Cancel',
      confirmVariant: 'primary',
    };

    return new Promise<boolean>((resolve) => {
      resolver.value = resolve;
    });
  }

  return {
    state: readonly(state),
    open,
    close,
    confirm,
    alert,
  };
}
