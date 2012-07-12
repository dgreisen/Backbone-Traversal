$(function(){
  
  // Contact Model
  // -------------

  // Our basic **Contact** model has `name`, `email`, `phone` and `events`
  // attributes
  var Contact = Backbone.Model.extend({ 
    // ensure that each contact has a `events` attribute.
    initialize: function(options) {
      if (!this.get('events')) {
        this.set({events: []});
      }
    },
    
    // Determine whether this contact belongs to the given events
    attendingEvent: function(e) {
      var events = this.get('events');
      return events.indexOf(e) > -1;
    }
  })
    
  // Contact Collection
  // ------------------
  
  // The collection of contacts is backed by localStorage instead of a remote 
  // server.
  var Contacts = Backbone.Collection.extend({ 
    // Reference to this collection's model.
    model: Contact,
    
    // Save all of the contacts items under the "contacts" namespace.
    localStorage: new Store("contacts-backbone"),

    // Filter down the list to only contacts belonging to a events.
    byEvent: function(e) {
      return this.filter(function(c) {return c.attendingEvent(e)});
    },
    
    // we sort the contacts by alphabetical order
    comparator: function(contact) {
      return contact.get('name');
    },
  })
  
  // Create our global collection of **Contacts**.
  var contacts = new Contacts();
  
  // Populate our collection with data
  contacts.reset(
    [ {name: "John Doe", email: "jdoe@example.com", phone: "202-555-1234", events: [1], id: 1}
    , {name: "Mary Smith", email: "msmith@example.com", phone: "202-555-5678", events: [1,3], id: 2}
    , {name: "Mia Lee", email: "mlee@example.com", phone: "202-555-9012", events: [2], id: 3}
    , {name: "Joe Rodriguez", email: "jrodriguez@example.com", phone: "202-555-3456", events: [3], id: 4}
    ])

  // Event Model
  // -------------

  // Our basic **Event** model has a `name`, `location` and `date` attribute
  var Event = Backbone.Model.extend({})
    
  // Events Collection
  // ------------------
  
  // The collection of events is backed by localStorage instead of a remote 
  // server.
  var Events = Backbone.Collection.extend({
    // Reference to this collection's model.
    model: Event,
    
    // Save all of the contacts items under the "events" namespace.
    localStorage: new Store("events-backbone"),

  })
  
  // Create our global collection of **Events**.
  var events = new Events();
  
  // Populate our collection with data
  events.reset(
    [ {name: "Birthday Party", date:"11/8/2014", location:"Home", id: 1}
    , {name: "Meeting", date:"3/2/2014", location:"Work", id: 2}
    , {name: "Lunch", date: "4/21/2014", location:"Greasy Spoon", id: 3}
    ]
    )

  // Root Node
  // ---------
  // the root node corresponds to our homepage. 

  var RootNode = Backbone.RootNode.extend({ 
    // The root node defaults to matching `/`, so no need to define 
    // `urlMatch`

    // notice we do not need a render() function - it will default to 
    // rendering the template into the specified element

    // On instantiation, `template` will be converted from a selector
    // to a template function using the function defined in `_templater`
    // which defaults to `_.template`.
      template: "#template-root"

    // define the element into which to insert content, this will be 
    // inherited by all child nodes (although it can be overridden)
    ,  el: $('#content')

    // Create getters for template use
    , getShortTitle: function() {return "Home"}
    , getTitle: function() {return "Event Book"}
    })

  var EventsNode = Backbone.Node.extend({
    // this nod selected if if the urlBit after root is `"events"`
      urlMatch: "events"

    // set the associated collection. 
    , collection: events

    // notice, again, no need for a render() function - the template function is 
    // passed a reference to `collection`, so we can access all events from 
    // within the template
    
    // set the template
    , template: "#template-events"

    // notice we do not have to provide an `el` - it is inherited from its 
    // parent node.

    // Create getters for template use
    , getShortTitle: function() {return "Events"}
    , getTitle: function() {return "Events"}
    })

  var ContactsNode = Backbone.Node.extend({
    // this node selected if the urlBit after root is `"contacts"`
      urlMatch: "contacts"

    // set the associated collection. 
    , collection: contacts

    // set the template
    , template: "#template-contacts"

    // Create getters for template use
    , getShortTitle: function() {return "Contacts"}
    , getTitle: function() {return "Contacts"}
  })

  var ContactNode = Backbone.Node.extend({
    // this node is always selected, and the matched data goes into `kwargs.id`
      urlMatch: ":id"

    // set the associated collection.
    , collection: contacts

    // notice, again, no need for a render() function - uppon traversal, the 
    // node attempted to find a model matching all the kwargs pulled from the
    // url. If a model was found, it was passed to the template function.
    
    // set the template
    , template: "#template-contact"

    // Create getters for template use
    , getShortTitle: function() {return this.model.get('name')}
    , getTitle: function() {return this.model.get('name')}
    })

  var EventNode = Backbone.Node.extend({
    // this node is always selected, and the matched data goes into `kwargs.id`
      urlMatch: ":id"

    // set the associated collection.
    , collection: events
    
    // set the template
    , template: "#template-event"

    // We could use the default render function, but then we would need lots
    // of logic in our template. Instead, do the logic in render.
    , render: function(options) {

        // get the attendees
        var attendees = contacts.byEvent(this.model.get('id'));
        // create hash of needed details
        attendees = _.map(attendees, function(a) {return {name:a.get('name'), id: a.get('id')}})

        context = 
          { name: this.model.get('name')
          , date: this.model.get('date')
          , location: this.model.get('location')
          , attendees: attendees
          }

        this.$el.html(this.template(context))
      }

    // Create getters for template use
    , getShortTitle: function() {return this.model.get('name')}
    , getTitle: function() {return this.model.get('name')}
    })

  // Node Instance Tree
  // ------------------
  // Create the actual node instances, starting with the root node, and adding
  // children to it. Use an array for more than one child node.
  node = new RootNode({children: 
    [ new EventsNode({children:
        new EventNode()})
    , new ContactsNode({children:
        new ContactNode()})
    ]})

  // Frame View
  // ----------
  // View that handles the common frame surrounding the content

  var FrameView = Backbone.View.extend({

      constructor: function() {
        // listen for `visited` events from the root node
        node.on('visited', this.render, this);
      }
    , render: function(node) {
        // set the title
        $('#title').html(node.getTitle());

        // generate and set the breadcrumbs
        var ancestors = node.getAncestors();
        ancestors.pop()
        var breadcrumbs = _.reduce(ancestors, function(o, n) {return o+'<li><a href="#'+n.fullPath.join('/')+'" >'+n.getShortTitle()+'</a> <span class="divider">|</span></li>'}, '')
        breadcrumbs += node.getShortTitle();
        $('#breadcrumbs').html(breadcrumbs);
    }
    })

  // create single instance of FrameView
  frameview = new FrameView()

  // Set up the router with a single route pointing everything to the root 
  // node. Note multiple root nodes can coexist with an arbitrary number of
  // traditional routes.
  Router = Backbone.Router.extend(
    { routes: {"*everything": "handle_route"}
    
    // a simple route handler to forward the path to the root node
    , handle_route: function(path) {
        node.visit(path)
      }
    })

  // create a single instance of the Router
  router = new Router();

  // start the router - currently `pushState` is not supported
  Backbone.history.start();
})


