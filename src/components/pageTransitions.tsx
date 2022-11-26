import { TransitionGroup, CSSTransition } from "react-transition-group";
import styled from "styled-components";

const PageTransitions: React.FC<{
  children: any;
  route: string;
  routingPageOffset: number;
}> = ({ children, route, routingPageOffset }) => {
  return (
    <>
      <TransitionGroup component={null}>
        <CSSTransition key={route} classNames="page" timeout={1000}>
          <MainComponent routingPageOffset={routingPageOffset}>
            {children}
          </MainComponent>
        </CSSTransition>
      </TransitionGroup>
      <Wipe className="wipe" />
    </>
  );
};

export default PageTransitions;

const MainComponent = styled.div<{ routingPageOffset: number }>`
  &.page-enter-active {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    opacity: 0;
  }

  &.page-exit {
    ~ .wipe {
      transform: translateY(100%);
    }
  }

  &.page-exit-active {
    ~ .wipe {
      transform: translateY(0);
      transition: transform 1000ms ease;
    }

    main {
      transform: translateY(-${(props) => props.routingPageOffset}px);
    }
  }

  &.page-enter-done {
    ~ .wipe {
      transform: translateY(-100%);
      transition: transform 1000ms ease;
    }
  }
`;

const Wipe = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100vh;
  background-color: #aaa;
  z-index: 5;
  transform: translateY(100%);
`;
