/**
 * Copyright 2019, Yahoo Holdings Inc.
 * Licensed under the terms of the MIT license. See accompanying LICENSE.md file for terms.
 */
import { computed, get, set, setProperties } from '@ember/object';
import { A as arr, makeArray } from '@ember/array';
import { isEmpty } from '@ember/utils';
import Route from '@ember/routing/route';
import { inject as service } from '@ember/service';
import { all } from 'rsvp';

export default Route.extend({
  /**
   * @property {Service} user
   */
  user: service(),

  /**
   * @property {DS.Model} currentDashboard - current dashboard model
   */
  currentDashboard: computed(function() {
    return this.modelFor(this.routeName);
  }).volatile(),

  /**
   * @property {Service} naviNotifications
   */
  naviNotifications: service(),

  /**
   * Makes an ajax request to retrieve relevant widgets in the dashboard
   *
   * @method model
   * @override
   * @param {Object} param
   * @param {String} param.dashboardId - id of dashboard
   * @returns {Promise} Promise that resolves to a dashboard model
   *
   */
  model({ dashboard_id }) {
    return get(this, 'store').find('dashboard', dashboard_id);
  },

  /**
   * Updates the dashboard layout property given a list of dashboard items
   * that have changed
   *
   * @method _updateLayout
   * @param {Array} updatedWidgets - list of widgets
   * @private
   * @return {Void}
   */
  _updateLayout(updatedWidgets) {
    const dashboard = get(this, 'currentDashboard');
    const layout = get(dashboard, 'presentation.layout');

    makeArray(updatedWidgets).forEach(updatedWidget => {
      let modelWidget = layout.find(widget => widget.get('widgetId') === Number(updatedWidget.id));

      //Make sure the widget is still a member of the dashboard
      if (modelWidget) {
        let { y: row, x: column, height, width } = updatedWidget;
        setProperties(modelWidget, { column, row, height, width });
      }
    });
  },

  /**
   * Notifies user about errors
   *
   * @method showErrorNotification
   * @param {String} message - The notification error message to be displayed
   * @returns {Void}
   */
  showErrorNotification(message) {
    get(this, 'naviNotifications').add({
      message: message,
      type: 'danger',
      timeout: 'medium'
    });
  },

  /**
   * @override
   * @method resetController - reset query params on exit of route
   * @param {Object} controller
   * @param {Boolean} isExiting
   */
  deactivate() {
    this._super(...arguments);
    const dashboard = this.modelFor(this.routeName);
    // don't rollback attributes if dashboard was unloaded.
    if (dashboard.isEmpty !== true) {
      dashboard.rollbackAttributes();
    }
  },

  /**
   * If traveling to the same route as the current dashboard, cache the query for breadcrumb purposes
   * @param {Transition} transition
   */
  cacheQuery(transition) {
    const controller = this.controllerFor(this.routeName);
    if (transition.from && transition.from.queryParams) {
      const fromRoute = transition.from.find(info => info.paramNames.includes('dashboard_id'));
      const fromDashboardId = fromRoute ? fromRoute.params.dashboard_id : null;
      const toRoute = transition.to && transition.to.find(info => info.paramNames.includes('dashboard_id'));
      const toDashboardId = toRoute ? toRoute.params.dashboard_id : null;

      if (fromDashboardId === toDashboardId) {
        controller.set('queryCache', transition.from.queryParams);
        return;
      }
    }
    this.controller.set('queryCache', null);
  },

  actions: {
    /**
     * @action didUpdateLayout - updates dashboard's layout property and save it
     * @param {Event} event - event object
     * @param {Array} [widgets] - Array of widgets that updated
     */
    didUpdateLayout(event, widgets) {
      this._updateLayout(widgets);
    },

    /**
     * @action saveDashboard - saves dashboard updates
     */
    saveDashboard() {
      const dashboard = get(this, 'currentDashboard');
      const widgets = get(this, 'currentDashboard.widgets');

      return dashboard
        .save()
        .then(all(widgets.map(async widget => widget.hasDirtyAttributes && widget.save())))
        .catch(() => {
          get(this, 'naviNotifications').add({
            message: 'OOPS! An error occured while trying to save your dashboard.',
            type: 'danger',
            timeout: 'short'
          });
        });
    },

    /**
     * @action deleteWidget
     * @param {DS.Model} widgetModel - object to delete
     */
    deleteWidget(widgetModel) {
      const id = get(widgetModel, 'id');

      widgetModel.deleteRecord();

      // Remove layout reference
      const presentation = get(this, 'currentDashboard.presentation');
      const newLayout = arr(get(presentation, 'layout')).rejectBy('widgetId', Number(id));

      set(presentation, 'layout', newLayout);

      return this.transitionTo('dashboards.dashboard', this.get('currentDashboard.id'));
    },

    /**
     * @action toggleFavorite - toggles favorite dashboard
     */
    toggleFavorite(dashboard) {
      let user = get(this, 'user').getUser(),
        isFavorite = get(dashboard, 'isFavorite'),
        updateOperation = isFavorite ? 'removeObject' : 'addObject',
        rollbackOperation = isFavorite ? 'addObject' : 'removeObject';

      get(user, 'favoriteDashboards')[updateOperation](dashboard);
      user.save().catch(() => {
        //manually rollback - fix once ember-data has a way to rollback relationships
        get(user, 'favoriteDashboards')[rollbackOperation](dashboard);
        this.showErrorNotification('OOPS! An error occurred while updating favorite dashboards');
      });
    },

    /**
     * @action updateTitle
     *
     * Updates dashboard model's title, unless new title is empty
     * @param {String} title
     */
    updateTitle(title) {
      if (!isEmpty(title)) {
        let dashboard = get(this, 'currentDashboard');
        set(dashboard, 'title', title);
      }
    },

    /**
     * Revert the dashboard.
     *
     * @action revertDashboard
     */
    revertDashboard() {
      const dashboard = get(this, 'currentDashboard');
      get(dashboard, 'widgets').forEach(widget => widget.rollbackAttributes());
      dashboard.rollbackAttributes();
    },

    /**
     * Prompts user if they are leaving the route with unsaved changes.
     * @param {Transition} transition
     */
    willTransition(transition) {
      //subroute cache queryString and continue
      if (transition.targetName.startsWith(this.routeName)) {
        this.cacheQuery(transition);
        return true;
      }

      const dashboard = get(this, 'currentDashboard');

      const isDirty =
        dashboard.get('hasDirtyAttributes') ||
        dashboard.get('filters.hasDirtyAttributes') ||
        dashboard.get('presentation.hasDirtyAttributes');

      if (
        isDirty &&
        dashboard.get('canUserEdit') &&
        !confirm('You have unsaved changes, are you sure you want to exit?')
      ) {
        transition.abort();
      } else {
        return true;
      }
    }
  }
});
