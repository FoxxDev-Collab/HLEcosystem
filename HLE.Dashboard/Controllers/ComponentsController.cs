using Microsoft.AspNetCore.Mvc;

namespace HLE.Dashboard.Controllers;

public class ComponentsController : Controller
{
    public IActionResult Index()
    {
        return View();
    }

    public IActionResult Demo()
    {
        return View();
    }
}
