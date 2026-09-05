declare const browser: {
  storage: {
    local: {
      get(key: string): Promise<Record<string, unknown>>;

      set(values: Record<string, unknown>): Promise<void>;

      remove(key: string): Promise<void>;
    };
  };

  runtime: {
    onInstalled: { addListener(callback: () => void): void };

    onMessage: { addListener(callback: (message: any) => unknown): void };

    sendMessage(message: unknown): Promise<any>;
  };

  menus: {
    create(options: { id: string; title: string; contexts: string[] }): void;

    onClicked: {
      addListener(
        callback: (info: {
          menuItemId: string | number;
          linkUrl?: string;
          selectionText?: string;
        }) => void,
      ): void;
    };
  };

  action: {
    openPopup(): Promise<void>;

    setBadgeText(options: { text: string }): Promise<void>;
  };
};
