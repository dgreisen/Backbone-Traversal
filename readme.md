Backbone-Traversal
==================

Backbone-Traversal reduces boilerplate for, and greatly simplifies the 
writing of, backbone web applications with a hierarchical structure. 

this package adds a `Backbone.RootNode`, and a `Backbone.Node` class. Each
node represents a ui "page". nodes contain child nodes, and each node is 
reached via a url. Thus if you have the following node structure:

    root
     |-Events
     |   |-Event
     |-Contacts
     |   |-Contact

You can reach a particular event by going to the url `#/events/832` where 832 
is the id of the event to be displayed. 

The rootnode is hooked into Backbone.Router by having the desired route call
rootnode.visit(path), where path is captured from a '*' in the route regex.
One or more node trees can happily coexist with an arbitrary number of routes.

The node tree takes advantage of inheritence to reduce duplicate code while
preserving maximum freedom. It also provides many conveniences, such as
automatically looking up a model from a given url, automatically 
converting a jquery selector into a template, and automatically rendering a
template with a useful context, while maintaining full customizability. 

The source code is well annotated. There is a complete and well-commented
example app, as well. 

This package will greatly reduce development time, while maintaining maximum
flexibility for the developer **if and only if** your web app follows a 
hierarchical design pattern.

I welcome patches and comments.