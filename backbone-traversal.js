(function() {
  // Backbone.Node
  // -------------------

  // Nodes are an addon for the traditional Backbone.Router. Nodes are
  // subclassed from Views. When the `visit` method of a RootNode is called 
  // with a path, it traverses each child node until it arrives at, and 
  // renders, the destination node.

  // Cached regular expressions for matching named param parts and splatted 
  // parts of route strings.
  var namedParam    = /:(\w+)/g;
  var escapeRegExp  = /[-[\]{}()+?.,\\^$|#\s]/g;

  // List of node options to be merged as properties.
  var nodeOptions = 
    ['children'
    , 'model'
    , 'collection'
    , 'urlMatch' 
    , 'kwargKeys'
    , 'className'
    , 'name'
    , 'el', 'id', 'attributes', 'className', 'tagName'];
  
  var Node = Backbone.Node = Backbone.View.extend(
    // a reference to the parent node
    { parent: null
    // either a child node , or a list of child nodes
    , children: []
    
    // if collection points to a collection, then when this node is traversed
    // the model will be set to the model specified by the urlMatch.
    , collection: null
    
    // the urlMatch is used to determine if this item should be traversed
    // it can either be a regex or a string that uses :param, but it cannot use
    //  *splat, since only the path between two slashes is being analyzed. 
    // defaults to matching anything.
    , urlMatch: /^.*$/
    
    // name of the node instance for finding in the node tree
    , name: null

    // name of the node class for finding in the node tree
    , className: null

    // `kwargKeys` are used to convert unnamed regex groups into a hash stored 
    // in `kwargs`. If `urlMatch` is a string using :params, `kwargKeys` is
    // autogenerated; if `urlMatch` is a regex you must specify `kwargKeys`.
    // If `kwargKeys` are not specified, matched groups will be placed in 
    // `args`.
    , kwargKeys: []
    
    // ### modified on traversal ###
    // path component stringcorresponding to this node
    , path: null
    // full path array to this node
    , fullPath: null
    // keyword arguments pulled from regex
    , kwargs: {}
    // arguments pulled from regex that were not provided keys in kwargKeys
    , args: []
    
    // there is no default `tagname` for a node, if no `tagname and no `el` 
    // are specified, then the parent's `el` will be used
    , tagName: undefined
    
    // Whether to render template when traversal terminates at this node. 
    // Inherits from `parent` if undefined
    , autoRender: undefined

    // The function for processing templates. Inherits from `parent` if 
    // undefined
    , _templater: undefined
        
    // Performs the initial configuration of a Node with a set of options. Keys 
    // with special meaning (model, collection, id, className), are attached 
    // directly to the node. sets up the children nodes as well
    , _configure: function(options) {
        // handle options
        if (this.options) options = _.extend({}, this.options, options);
        for (var i = 0, l = nodeOptions.length; i < l; i++) {
          var attr = nodeOptions[i];
          if (options[attr]) this[attr] = options[attr];
        }
        this.options = options;
        
        // handle path urlMatch conversion
        // replace strings with the appropriate regex, generate kwargKeys
        if (typeof(this.urlMatch) == "string") {
          var s = this.urlMatch;
          var re = /:(\w+)/
          this.kwargKeys = [];
          while (true) {
            var r = re.exec(s);
            if (!r) break;
            this.kwargKeys.push(r[1]);
            s = s.replace(re, '(.+)');
          }
          this.urlMatch = new RegExp('^'+s+'$');
        }
        
        // listify single instance of Child Node
        if (this.children instanceof Node) {
          this.children = [this.children]
        }

      }
    
    // ensures inheritence occurs properly, as well as cleans up children 
    // if you need to do something after inheritence has been setup, create
    // a function called `initialized` or `constructed`
    , _inheritance: function(root) {
        // handle template - if `template` is a string, treat it as a 
        // selector,get the html, and run it through the templating function
        // `_templater`; _templater defaults to `_.template`.
        if (typeof(this.template) == "string") {
          this.template = this.get('_templater')($(this.template).html())
        }

        // add a reference to root
        this.root = root;

        for (i in this.children) {
          // `parent`
          this.children[i].parent = this;
          // `el`
          if (!this.children[i].el) this.children[i].setElement(this.el);

          // proxy events
          this.children[i].on('all', root._onNodeEvent, root);

          // recurse through children
          this.children[i]._inheritance(root);
          

        }

        if (this.initialized) {this.initialized()}
        else if (this.constructed) {this.constructed()}
      }
      
    // Ensure that the View has a DOM element to render into.
    // If `this.el` is a string, pass it through `$()`, take the first
    // matching element, and re-assign it to `el`. Otherwise, create
    // an element from the `id`, `className` and `tagName` properties if tagName
    // exists. If it does not exist, it will inherit from its parent node.
    // if the parent node has no el, it will fail silently!.
    , _ensureElement: function() {
        if (!this.el && this.tagName) {
          var attrs = getValue(this, 'attributes') || {};
          if (this.id) attrs.id = this.id;
          if (this.className) attrs['class'] = this.className;
          this.setElement(this.make(this.tagName, attrs), false);
        } 
        else {
          this.setElement(this.el, false);
        }
      }
  
    // recursively called to visit a node specified by a path. calls the 
    // traverse(options) method defined by the subclass, emits a "traversed" 
    // event, then calls `visit` method of appropriate child node.  
    // 
    // Options hash contains:
    // * `path`: list of untraversed portion of path (including the bit 
    // corresponding to this node)
    // * `pathParent`: path to parent
    , visit: function(options) {
        
        // check whether the pathBit matches our urlMatch; if not, return false
        var matchResult = this.urlMatch.exec(options.path[0])
        
        if (!matchResult) {
          return false
        }

        //pop the pathBit
        var pathBit = options.path.shift();
        
        // set various parameters on the node
        this.path = pathBit
        options.pathParent.push(pathBit);
        this.fullPath = _.clone(options.pathParent)
        this.url = '#'+this.fullPath.join('/')
        // kwargs
        matchResult.shift()
        for (i in this.kwargKeys) {
          this.kwargs[this.kwargKeys[i]] = matchResult.shift();
        }
        // args
        this.args = matchResult;
        
        
        // As a convenience, if `collection` is set, then will attempt to get 
        // a model matching the kwargs regexed from the path. If found, 
        // will set `this.model` to the found model.
        if (this.collection && !_.isEmpty(this.kwargs)) {
          // shortcut and get by id if 'id' is in `kwargs`
          if ('id' in this.kwargs) {
            this.model = this.collection.get(this.kwargs.id)
          }
          // otherwise get first model to match all kwargs
          else {
            this.model = this.collection.find(function(obj) {
              var result = true;
              for (k in this.kwargs) {
                result = result && (this.kwargs[k]==obj.get(k));
                if (!result) break;
              }
              return result;
            }, this)
          }
        }

        // emit `traversed` event
        this.trigger("traversed", this);

        // call the traverse method, defined in subclass
        var trav_opts = { pathBit: pathBit
                        , kwargs: this.kwargs
                        , args:this.args
                        }
        _.extend(trav_opts, options)
        var resp = this.traverse(trav_opts);

        // if `traverse()` returns false, terminate traversal
        if (resp===false) return
        // if we have not yet reached our destination
        if (options.path.length) {
          // visit children
          var success = false;
          for (i in this.children) {
            success = this.children[i].visit(options);
            if (success) break;
          }
          // if no children successfully visited, throw event error
          if (!success) {
            this.trigger("traversalError", this, options.path, options.pathParent);
          }
        }
        // if we have reached destination
        else {
          // emit `visited` event
          this.trigger("visited", this);
          // unless overridden by setting `this.autoRender = false, call render
          if (this.get('autoRender') !== false) {
            this.render({ model: this.model
                        , collection: this.collection
                        , args: this.args
                        , kwargs: this.kwargs
                        , path: this.fullPath
                        , url: this.url
                        })
          }
        }
        return true;
      }
      
    // defined by subclass, called whenever a node is traversed. options hash
    // contains:
    // * `path`: untraversed portion of path (including the bit corresponding to
    // this node)
    // * `pathParent`: full path
    // * `pathBit`: the path bit corresponding to this node
    // * kwargs: hash of any data collected from path regex
    // * args: list of any data collected from path regex w/o corresponding 
    // kwargKeys
    , traverse: function(options) {
        return null;
      }

    // render can be overridden by subclass. Defaults to rendering `template`
    // in `$el`. When called by `visit`, it will be passed the following:
    // * model: model instance associated with this node
    // collection: collection instance associated with this class
    // args: arguments pulled from the regexed pathbit
    // kwargs: keyword hash pulled from the regexed pathbit
    // path: the path, in Array form
    , render: function(options) {
        var context = _.extend(options, this.addContext())
        var html = this.template(options);
        this.$el.html(html);
      }

    // hook for adding custom context keys to the template call. 
    , addContext: function() {}

    // return a list of ancestors, root first, this last.
    , getAncestors: function() {
        if (this.parent) {
          var resp = this.parent.getAncestors();
          resp.push(this);
          return resp
        }
        else {
          return [this]
        }
      }
    // return the first ancestor with the given `name` or `className`
    // if arg is a string rather than a hash, it is treated as a `name`
    // will return self if self matches
    , getAncestor: function(opts) {
        if (typeof(opts) == 'string') opts = {name: opts}
        if (  (opts.name && this.name == opts.name)
           || (opts.className && this.className == opts.className)) {
          return this
        }          
        else if (this.parent) {
          return this.parent.getAncestor(opts)
        }
        return undefined
      }
    // get(attr, inherit=true) get an attribute from this Node instance.
    // 1) if getter exists, return getter value get prepended to a first-
    // letter capitalized attribute. e.g. getter for `name` would be `getName`
    // 2) if attr is undefined, and `inherit` is true call `parent.get`
    // 3) otherwise, return attr value
    // optional second parameter, `opts` can contain:
    // * `inherit`: whether to perform inheritence lookup. defaults to true
    // * `proxy`: if return is a method - whether to bind to the 
    // calling node (proxy == true) or to the ancestor node where the
    //  method was defined (proxyd == false). defaults to true
    , get: function(attr, opts, inner) {
        opts = opts || {};
        var inherit = (opts.inherit===undefined) ? true : opts.inherit;
        var proxy = (opts.proxy===undefined) ? true : opts.proxy;
        var getter = 'get'+attr[0].toUpperCase()+attr.slice(1);
        var resp = null
        if (this[getter]) {
          resp = this[getter]()
          if (resp instanceof Function && !proxy) {
            resp = jQuery.proxy(resp, this);
          }
        }
        else if (this[attr] === undefined && this.parent && inherit) {
          resp = this.parent.get(attr, opts, true);
        }
        else {
          resp = this[attr];
          if (resp instanceof Function && !proxy) {
            resp = jQuery.proxy(resp, this);
          }
        }

        // ensure any method is proxied to the child node that called the
        // original `get`
        if (resp instanceof Function && !inner && proxy) {
          resp = jQuery.proxy(resp, this);
        }

        return resp
      }
    })
  
  
  var RootNode = Backbone.RootNode = Backbone.Node.extend(
    { 

    // _templater default - inherited by all child nodes unless overridden
      _templater: _.template

    // autoRender default -inherited by all child nodes unless overridden
    , autoRender: true

    // the current node
    , currentNode: null

    , _configure: function(options) {
        Backbone.Node.prototype._configure.call(this, options);
        this._inheritance(this);
      }
    , visit: function(path) {
        // convert the path string to a list
        // add a slash to string if string is not empty so root node aligns 
        // with root path
        if (!path || path == '/')
          {path = ''}
        else if (path[0] != '/')
          {path = '/'+path}
        path = path.split('/');
        // call super with new path
        Backbone.Node.prototype.visit.call(this, {path: path, pathParent: []});
      }
    // called on every event triggered by a subnode. sets `currentNode`, and
    // proxies everything
    , _onNodeEvent: function(e, node) {
        if (e == "visited") {
          this.currentNode = node;
        }
        this.trigger(e, node)
      }
    })

}).call(this);
