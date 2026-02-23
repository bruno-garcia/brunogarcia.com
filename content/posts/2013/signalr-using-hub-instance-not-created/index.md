---
title: "SignalR: Using a Hub instance not created by the HubPipeline is unsupported"
date: 2013-02-23T00:53:00.000+01:00
tags: ["C#", "SignalR", "ASP.NET"]
author: "Bruno Garcia"
showToc: false
draft: false
aliases:
  - /blogger/2013/signalr-using-hub-instance-not-created/
  - /2013/02/signalr-using-hub-instance-not-created.html
description: "Fix for the SignalR error 'Using a Hub instance not created by the HubPipeline is unsupported' — use GetHubContext instead of creating a new Hub instance."
---

When you need to push data to a SignalR hub from outside the hub (from a Controller for example), don't try to create a new instance of the Hub, like I did. Otherwise you'll see this nice exception:

> Using a Hub instance not created by the HubPipeline is unsupported

From `Microsoft.AspNet.SignalR.Core`

Instead, the hub context must be retrieved:

```csharp
var context = GlobalHost.ConnectionManager.GetHubContext<HubType>();
context.Clients.All.Whatever();
```
