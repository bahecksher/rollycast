import { Component, type ErrorInfo, type ReactNode } from 'react';

interface SceneErrorBoundaryProps {
  children: ReactNode;
}

interface SceneErrorBoundaryState {
  failed: boolean;
}

/** Keeps the shared text controls usable if the 3D scene or physics runtime fails to load. */
export class SceneErrorBoundary extends Component<
  SceneErrorBoundaryProps,
  SceneErrorBoundaryState
> {
  override state: SceneErrorBoundaryState = { failed: false };

  static getDerivedStateFromError(): SceneErrorBoundaryState {
    return { failed: true };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('The 3D dice scene failed to load.', error, info.componentStack);
  }

  override render() {
    if (this.state.failed) {
      return (
        <div className="room-placeholder" role="status">
          <p className="room-placeholder-title">The 3D table couldn’t start</p>
          <p className="room-placeholder-text">
            You can keep using the roll controls, shared results, history, and die actions below.
          </p>
        </div>
      );
    }
    return this.props.children;
  }
}
