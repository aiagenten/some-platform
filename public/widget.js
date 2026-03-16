/**
 * SoMe Embeddable Widget — Web Component
 *
 * Usage:
 *   <script src="https://your-domain.com/widget.js"></script>
 *   <some-widget token="abc123" type="calendar" theme="light"></some-widget>
 *
 * Attributes:
 *   - token  (required): Embed token from the SoMe dashboard
 *   - type   (required): Widget type — "calendar", "approval", or "feed"
 *   - theme  (optional): "light" (default) or "dark"
 */
(function () {
  'use strict';

  const WIDGET_BASE_URL =
    document.currentScript?.src
      ? new URL(document.currentScript.src).origin
      : window.location.origin;

  class SomeWidget extends HTMLElement {
    constructor() {
      super();
      this._iframe = null;
      this._shadow = this.attachShadow({ mode: 'open' });
    }

    static get observedAttributes() {
      return ['token', 'type', 'theme'];
    }

    connectedCallback() {
      this._render();
      window.addEventListener('message', this._handleMessage.bind(this));
    }

    disconnectedCallback() {
      window.removeEventListener('message', this._handleMessage.bind(this));
    }

    attributeChangedCallback() {
      if (this._iframe) {
        this._render();
      }
    }

    _handleMessage(event) {
      // Only accept messages from our iframe origin
      if (event.origin !== WIDGET_BASE_URL) return;
      if (!event.data || event.data.type !== 'some-widget-resize') return;

      const height = event.data.height;
      if (height && this._iframe) {
        this._iframe.style.height = height + 'px';
      }
    }

    _render() {
      const token = this.getAttribute('token') || '';
      const type = this.getAttribute('type') || 'calendar';
      const theme = this.getAttribute('theme') || 'light';

      if (!token) {
        this._shadow.innerHTML = '<p style="color:red;font-family:sans-serif;">⚠️ Missing token attribute</p>';
        return;
      }

      const validTypes = ['calendar', 'approval', 'feed'];
      if (!validTypes.includes(type)) {
        this._shadow.innerHTML = '<p style="color:red;font-family:sans-serif;">⚠️ Invalid type: ' + type + '</p>';
        return;
      }

      const src = `${WIDGET_BASE_URL}/embed/${encodeURIComponent(type)}?token=${encodeURIComponent(token)}&theme=${encodeURIComponent(theme)}`;

      this._shadow.innerHTML = `
        <style>
          :host {
            display: block;
            width: 100%;
          }
          iframe {
            width: 100%;
            border: none;
            overflow: hidden;
            transition: height 0.2s ease;
          }
        </style>
        <iframe
          src="${src}"
          title="SoMe ${type} widget"
          loading="lazy"
          sandbox="allow-scripts allow-same-origin allow-popups"
        ></iframe>
      `;

      this._iframe = this._shadow.querySelector('iframe');
    }
  }

  if (!customElements.get('some-widget')) {
    customElements.define('some-widget', SomeWidget);
  }
})();
