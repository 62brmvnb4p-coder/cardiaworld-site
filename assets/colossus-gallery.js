'use strict';

const colossusGallery = document.querySelector('[data-colossus-gallery]');

if (colossusGallery) {
  const tablist = colossusGallery.querySelector('[role="tablist"]');
  const tabs = Array.from(tablist?.querySelectorAll('[role="tab"]') ?? []);
  const stages = tabs.map(tab => document.getElementById(tab.getAttribute('aria-controls')));

  if (tabs.length && stages.every(stage => stage && colossusGallery.contains(stage))) {
    function showStage(index, focus = false) {
      tabs.forEach((tab, position) => {
        const selected = index === position;
        tab.setAttribute('aria-selected', String(selected));
        tab.tabIndex = selected ? 0 : -1;
        stages[position].hidden = !selected;
      });
      if (focus) tabs[index].focus();
    }

    tabs.forEach((tab, position) => {
      const stage = stages[position];
      stage.setAttribute('role', 'tabpanel');
      stage.setAttribute('aria-labelledby', tab.id);
      stage.tabIndex = 0;
      tab.addEventListener('click', () => showStage(position));
      tab.addEventListener('keydown', event => {
        let destination;
        switch (event.key) {
          case 'ArrowLeft':
          case 'ArrowUp':
            destination = (position - 1 + tabs.length) % tabs.length;
            break;
          case 'ArrowRight':
          case 'ArrowDown':
            destination = (position + 1) % tabs.length;
            break;
          case 'Home':
            destination = 0;
            break;
          case 'End':
            destination = tabs.length - 1;
            break;
          default:
            return;
        }
        event.preventDefault();
        showStage(destination, true);
      });
    });

    showStage(0);
    colossusGallery.setAttribute('data-enhanced', '');
    tablist.hidden = false;
  }
}
